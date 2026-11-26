import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { stepKart, detectSurface, collideKarts, collideBoxes } from '../game/physics'
import { aiInput } from '../game/ai'
import { pointAt, yawAt, LAP_LENGTH } from '../game/path'
import { SUN_DIR } from '../SkyDome'
import { LAPS, COUNTDOWN } from '../game/constants'

const scratchVec = new THREE.Vector3()     // reusable scratch vector (avoids per-frame allocation)
const behindVec = new THREE.Vector3()      // direction from player toward camera (behind kart)
const cameraTargetPos = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th')

export function useRaceLoop({ field, track, hud, keys, sun, onPhase, onFinish }) {
  const camera = useThree((s) => s.camera)
  const race = useRef({ t: 0, phase: 'countdown', lights: -1, results: [], hudT: 0, lapStart: 0, lastLap: 1, best: null, lapTimes: [] })

  useEffect(() => {
    const playerKartState = field.find((k) => k.player).st
    if (import.meta.env.DEV) window.__race = { field, race }
    camera.position.set(playerKartState.pos.x - Math.cos(playerKartState.yaw) * 9, 4, playerKartState.pos.z + Math.sin(playerKartState.yaw) * 9)
    camera.lookAt(playerKartState.pos)
    onPhase?.('countdown')
  }, [camera, field, onPhase])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const raceState = race.current
    raceState.t += dt
    const player = field.find((k) => k.player)
    const playerKart = player.st

    // ----- countdown & start lights -----
    if (raceState.phase === 'countdown') {
      const litCount = Math.min(5, Math.floor((raceState.t - 0.6) / 0.6) + 1)
      if (litCount !== raceState.lights) {
        raceState.lights = litCount
        track.bulbs.forEach((bulb, i) => { bulb.material.emissiveIntensity = i < litCount ? 5 : 0; bulb.material.emissive.set('#ff1a0a') })
      }
      if (raceState.t >= COUNTDOWN) {
        raceState.phase = 'race'; raceState.raceStart = raceState.t; raceState.lapStart = raceState.t
        track.bulbs.forEach((bulb) => { bulb.material.emissive.set('#19ff5a'); bulb.material.emissiveIntensity = 5 })
        onPhase?.('race')
      }
    }
    const racing = raceState.phase !== 'countdown'

    // ----- inputs + physics -----
    const input = keys.current
    if (input.reset && racing) { // respawn on the racing line
      const dist = playerKart.loc.dist
      playerKart.pos.copy(pointAt(dist, 0)); playerKart.yaw = playerKart.velYaw = yawAt(dist); playerKart.speed = 0
    }
    for (const racer of field) {
      const kartState = racer.st
      let racerInput
      if (!racing) racerInput = {}
      else if (racer.player && !kartState.finished && !(import.meta.env.DEV && window.__autopilot)) racerInput = input
      else racerInput = aiInput(kartState, racer.ai || { lane: 0, phase: 0, skill: 0.9 }, playerKart.raceDist + playerKart.offset - kartState.offset, raceState.t)
      if (racer.player && kartState.finished) kartState.maxMul = 0.85
      stepKart(kartState, racerInput, dt)
      collideBoxes(kartState, track.colliders.boxes)
      kartState.surface = detectSurface(kartState)
    }
    collideKarts(field.map((f) => f.st))

    // ----- laps, finish, positions -----
    for (const racer of field) {
      const kartState = racer.st
      kartState.progress = kartState.raceDist + kartState.offset
      if (!kartState.finished && kartState.progress >= LAPS * LAP_LENGTH && racing) {
        kartState.finished = true; kartState.finishTime = raceState.t - raceState.raceStart
        raceState.results.push({ name: racer.name, time: kartState.finishTime, player: !!racer.player, paint: racer.paint })
        if (racer.player) { raceState.phase = 'finished'; onPhase?.('finished'); onFinish?.(raceState.results.slice(), field) }
        else if (playerKart.finished) onFinish?.(raceState.results.slice(), field)
      }
    }
    const finishOrder = [...field].sort((a, b) => {
      if (a.st.finished && b.st.finished) return a.st.finishTime - b.st.finishTime
      if (a.st.finished !== b.st.finished) return a.st.finished ? -1 : 1
      return b.st.progress - a.st.progress
    })
    const playerPlace = finishOrder.indexOf(player) + 1
    const currentLap = Math.min(LAPS, Math.max(1, Math.floor(playerKart.progress / LAP_LENGTH) + 1))
    if (racing && !playerKart.finished && currentLap !== raceState.lastLap) {
      const lapTime = raceState.t - raceState.lapStart
      raceState.lapTimes.push(lapTime); raceState.best = raceState.best == null ? lapTime : Math.min(raceState.best, lapTime)
      raceState.lapStart = raceState.t; raceState.lastLap = currentLap
      raceState.flash = { text: currentLap === LAPS ? 'FINAL LAP!' : `LAP ${currentLap}`, until: raceState.t + 1.6 }
    }

    // ----- visuals -----
    const elapsed = state.clock.elapsedTime
    for (const racer of field) {
      const { st: kartState, kart } = racer
      kart.root.position.set(kartState.pos.x, 0, kartState.pos.z)
      kart.root.rotation.y = kartState.yaw
      const speedNorm = Math.min(Math.abs(kartState.speed) / 10, 1)              // 0–1, for bobbing intensity
      const speedSigned = Math.min(Math.abs(kartState.speed) / 8, 1) * (kartState.speed < 0 ? -1 : 1)
      kart.body.position.y = Math.sin(elapsed * 18 + racer.idx) * 0.012 * speedNorm
        + (kartState.surface === 'grass' ? Math.sin(elapsed * 40 + racer.idx) * 0.02 * speedNorm : 0)
        + (kartState.bump > 0 ? Math.sin(kartState.bump * 60) * 0.04 : 0)
      kart.body.rotation.x = THREE.MathUtils.damp(kart.body.rotation.x, -kartState.steer * speedSigned * 0.07 - (kartState.drifting ? kartState.steer * 0.08 : 0), 6, dt)
      kart.body.rotation.z = THREE.MathUtils.damp(kart.body.rotation.z, kartState.boost > 0 ? -0.05 : 0, 6, dt)
      for (const wheel of kart.wheels) {
        wheel.pivot.rotation.z -= (kartState.speed / wheel.r) * dt
        if (wheel.front) wheel.pivot.rotation.y = kartState.steer * 0.35
      }
      kart.driver.rotation.x = -kartState.steer * 0.18 * speedNorm
    }

    // ----- chase camera -----
    behindVec.set(-Math.cos(playerKart.yaw), 0, Math.sin(playerKart.yaw))
    const cameraDistance = raceState.phase === 'countdown' ? 9 + (COUNTDOWN - raceState.t) * 1.5 : 8.5 + Math.abs(playerKart.speed) * 0.05
    const cameraHeightOffset = 3.4 + (raceState.phase === 'countdown' ? (COUNTDOWN - raceState.t) * 0.6 : 0)
    cameraTargetPos.copy(playerKart.pos).addScaledVector(behindVec, cameraDistance).addScaledVector(UP, cameraHeightOffset)
    camera.position.lerp(cameraTargetPos, 1 - Math.exp(-dt * 5))
    camera.lookAt(scratchVec.copy(playerKart.pos).addScaledVector(behindVec, -3).addScaledVector(UP, 1.3))
    const targetFov = 60 + Math.abs(playerKart.speed) * 0.35 + (playerKart.boost > 0 ? 6 : 0)
    if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 3, dt); camera.updateProjectionMatrix() }

    if (sun.current) {
      sun.current.position.copy(playerKart.pos).addScaledVector(SUN_DIR, 90)
      sun.current.target.position.copy(playerKart.pos)
      sun.current.target.updateMatrixWorld()
    }

    // ----- HUD (direct DOM, throttled) -----
    raceState.hudT += dt
    const hudElements = hud.current
    if (hudElements.speed && raceState.hudT > 0.06) {
      raceState.hudT = 0
      hudElements.speed.textContent = Math.round(Math.abs(playerKart.speed) * 3.6)
      hudElements.pos.innerHTML = `${playerPlace}<sup>${ordinal(playerPlace).slice(String(playerPlace).length)}</sup><small>/${field.length}</small>`
      hudElements.lap.textContent = `${currentLap}/${LAPS}`
      hudElements.time.textContent = racing ? ((playerKart.finished ? playerKart.finishTime : raceState.t - raceState.raceStart)).toFixed(2) : '0.00'
      hudElements.best.textContent = raceState.best == null ? '--' : raceState.best.toFixed(2)
      hudElements.surface.textContent = playerKart.boost > 0 ? '🔥 BOOST!' : playerKart.drifting ? (playerKart.driftTime > 0.8 ? '✨ Release to boost!' : '💨 Drifting…') : playerKart.surface === 'grass' ? '🌱 Off track!' : ''
      hudElements.surface.style.opacity = hudElements.surface.textContent ? 1 : 0
      let bigMessage = ''
      if (raceState.phase === 'countdown') bigMessage = raceState.t < 0.6 ? '' : String(Math.max(1, 3 - Math.floor((raceState.t - 0.6) / 1.2)))
      else if (playerKart.finished) bigMessage = 'FINISH!'
      else if (raceState.t - raceState.raceStart < 1) bigMessage = 'GO!'
      else if (raceState.flash && raceState.t < raceState.flash.until) bigMessage = raceState.flash.text
      if (hudElements.big.textContent !== bigMessage) { hudElements.big.textContent = bigMessage; hudElements.big.classList.remove('pop'); void hudElements.big.offsetWidth; if (bigMessage) hudElements.big.classList.add('pop') }
      hudElements.board.innerHTML = finishOrder.map((racer, i) => `<li class="${racer.player ? 'me' : ''}"><i style="background:${racer.paint || '#1239d6'}"></i>${i + 1}. ${racer.name}</li>`).join('')
    }
  })
}
