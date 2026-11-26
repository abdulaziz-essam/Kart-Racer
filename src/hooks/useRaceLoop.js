import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { stepKart, detectSurface, collideKarts, collideBoxes } from '../game/physics'
import { aiInput } from '../game/ai'
import { pointAt, yawAt, LAP_LENGTH } from '../game/path'
import { SUN_DIR } from '../SkyDome'
import { LAPS, COUNTDOWN } from '../game/constants'

const tmp = new THREE.Vector3()
const back = new THREE.Vector3()
const camTarget = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th')

export function useRaceLoop({ field, track, hud, keys, sun, onPhase, onFinish }) {
  const camera = useThree((s) => s.camera)
  const race = useRef({ t: 0, phase: 'countdown', lights: -1, results: [], hudT: 0, lapStart: 0, lastLap: 1, best: null, lapTimes: [] })

  useEffect(() => {
    const p = field.find((k) => k.player).st
    if (import.meta.env.DEV) window.__race = { field, race }
    camera.position.set(p.pos.x - Math.cos(p.yaw) * 9, 4, p.pos.z + Math.sin(p.yaw) * 9)
    camera.lookAt(p.pos)
    onPhase?.('countdown')
  }, [camera, field, onPhase])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const R = race.current
    R.t += dt
    const player = field.find((k) => k.player)
    const P = player.st

    // ----- countdown & start lights -----
    if (R.phase === 'countdown') {
      const lit = Math.min(5, Math.floor((R.t - 0.6) / 0.6) + 1)
      if (lit !== R.lights) {
        R.lights = lit
        track.bulbs.forEach((b, i) => { b.material.emissiveIntensity = i < lit ? 5 : 0; b.material.emissive.set('#ff1a0a') })
      }
      if (R.t >= COUNTDOWN) {
        R.phase = 'race'; R.raceStart = R.t; R.lapStart = R.t
        track.bulbs.forEach((b) => { b.material.emissive.set('#19ff5a'); b.material.emissiveIntensity = 5 })
        onPhase?.('race')
      }
    }
    const racing = R.phase !== 'countdown'

    // ----- inputs + physics -----
    const k = keys.current
    if (k.reset && racing) { // respawn on the racing line
      const s = P.loc.dist
      P.pos.copy(pointAt(s, 0)); P.yaw = P.velYaw = yawAt(s); P.speed = 0
    }
    for (const kt of field) {
      const st = kt.st
      let input
      if (!racing) input = {}
      else if (kt.player && !st.finished && !(import.meta.env.DEV && window.__autopilot)) input = k
      else input = aiInput(st, kt.ai || { lane: 0, phase: 0, skill: 0.9 }, P.raceDist + P.offset - st.offset, R.t)
      if (kt.player && st.finished) st.maxMul = 0.85
      stepKart(st, input, dt)
      collideBoxes(st, track.colliders.boxes)
      st.surface = detectSurface(st)
    }
    collideKarts(field.map((f) => f.st))

    // ----- laps, finish, positions -----
    for (const kt of field) {
      const st = kt.st
      st.progress = st.raceDist + st.offset
      if (!st.finished && st.progress >= LAPS * LAP_LENGTH && racing) {
        st.finished = true; st.finishTime = R.t - R.raceStart
        R.results.push({ name: kt.name, time: st.finishTime, player: !!kt.player, paint: kt.paint })
        if (kt.player) { R.phase = 'finished'; onPhase?.('finished'); onFinish?.(R.results.slice(), field) }
        else if (P.finished) onFinish?.(R.results.slice(), field)
      }
    }
    const order = [...field].sort((a, b) => {
      if (a.st.finished && b.st.finished) return a.st.finishTime - b.st.finishTime
      if (a.st.finished !== b.st.finished) return a.st.finished ? -1 : 1
      return b.st.progress - a.st.progress
    })
    const place = order.indexOf(player) + 1
    const lap = Math.min(LAPS, Math.max(1, Math.floor(P.progress / LAP_LENGTH) + 1))
    if (racing && !P.finished && lap !== R.lastLap) {
      const lt = R.t - R.lapStart
      R.lapTimes.push(lt); R.best = R.best == null ? lt : Math.min(R.best, lt)
      R.lapStart = R.t; R.lastLap = lap
      R.flash = { text: lap === LAPS ? 'FINAL LAP!' : `LAP ${lap}`, until: R.t + 1.6 }
    }

    // ----- visuals -----
    const t = state.clock.elapsedTime
    for (const kt of field) {
      const { st, kart } = kt
      kart.root.position.set(st.pos.x, 0, st.pos.z)
      kart.root.rotation.y = st.yaw
      const sp = Math.min(Math.abs(st.speed) / 10, 1)
      const sf = Math.min(Math.abs(st.speed) / 8, 1) * (st.speed < 0 ? -1 : 1)
      kart.body.position.y = Math.sin(t * 18 + kt.idx) * 0.012 * sp
        + (st.surface === 'grass' ? Math.sin(t * 40 + kt.idx) * 0.02 * sp : 0)
        + (st.bump > 0 ? Math.sin(st.bump * 60) * 0.04 : 0)
      kart.body.rotation.x = THREE.MathUtils.damp(kart.body.rotation.x, -st.steer * sf * 0.07 - (st.drifting ? st.steer * 0.08 : 0), 6, dt)
      kart.body.rotation.z = THREE.MathUtils.damp(kart.body.rotation.z, st.boost > 0 ? -0.05 : 0, 6, dt)
      for (const w of kart.wheels) {
        w.pivot.rotation.z -= (st.speed / w.r) * dt
        if (w.front) w.pivot.rotation.y = st.steer * 0.35
      }
      kart.driver.rotation.x = -st.steer * 0.18 * sp
    }

    // ----- chase camera -----
    back.set(-Math.cos(P.yaw), 0, Math.sin(P.yaw))
    const dist = R.phase === 'countdown' ? 9 + (COUNTDOWN - R.t) * 1.5 : 8.5 + Math.abs(P.speed) * 0.05
    camTarget.copy(P.pos).addScaledVector(back, dist).addScaledVector(UP, 3.4 + (R.phase === 'countdown' ? (COUNTDOWN - R.t) * 0.6 : 0))
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 5))
    camera.lookAt(tmp.copy(P.pos).addScaledVector(back, -3).addScaledVector(UP, 1.3))
    const fov = 60 + Math.abs(P.speed) * 0.35 + (P.boost > 0 ? 6 : 0)
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = THREE.MathUtils.damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix() }

    if (sun.current) {
      sun.current.position.copy(P.pos).addScaledVector(SUN_DIR, 90)
      sun.current.target.position.copy(P.pos)
      sun.current.target.updateMatrixWorld()
    }

    // ----- HUD (direct DOM, throttled) -----
    R.hudT += dt
    const h = hud.current
    if (h.speed && R.hudT > 0.06) {
      R.hudT = 0
      h.speed.textContent = Math.round(Math.abs(P.speed) * 3.6)
      h.pos.innerHTML = `${place}<sup>${ordinal(place).slice(String(place).length)}</sup><small>/${field.length}</small>`
      h.lap.textContent = `${lap}/${LAPS}`
      h.time.textContent = racing ? ((P.finished ? P.finishTime : R.t - R.raceStart)).toFixed(2) : '0.00'
      h.best.textContent = R.best == null ? '--' : R.best.toFixed(2)
      h.surface.textContent = P.boost > 0 ? '🔥 BOOST!' : P.drifting ? (P.driftTime > 0.8 ? '✨ Release to boost!' : '💨 Drifting…') : P.surface === 'grass' ? '🌱 Off track!' : ''
      h.surface.style.opacity = h.surface.textContent ? 1 : 0
      let big = ''
      if (R.phase === 'countdown') big = R.t < 0.6 ? '' : String(Math.max(1, 3 - Math.floor((R.t - 0.6) / 1.2)))
      else if (P.finished) big = 'FINISH!'
      else if (R.t - R.raceStart < 1) big = 'GO!'
      else if (R.flash && R.t < R.flash.until) big = R.flash.text
      if (h.big.textContent !== big) { h.big.textContent = big; h.big.classList.remove('pop'); void h.big.offsetWidth; if (big) h.big.classList.add('pop') }
      h.board.innerHTML = order.map((kt, i) => `<li class="${kt.player ? 'me' : ''}"><i style="background:${kt.paint || '#1239d6'}"></i>${i + 1}. ${kt.name}</li>`).join('')
    }
  })
}
