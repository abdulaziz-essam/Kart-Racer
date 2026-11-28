import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { stepAllKarts } from './useKartPhysics'
import { stepCountdownLights } from './useCountdownLights'
import { useCameraChase } from './useCameraChase'
import { updateHud } from './useHudUpdate'
import { LAP_LENGTH } from '../game/path'
import { LAPS } from '../game/constants'
import { recordPracticeLap } from '../game/profile'

export function useRaceLoop({ field, track, hud, keys, sun, onPhase, onFinish, practice = false, paused = false }) {
  const race = useRef({ t: 0, phase: 'countdown', lights: -1, results: [], hudT: 0, lapStart: 0, lastLap: 1, best: null, lapTimes: [] })
  const finishOrderCache = useRef([...field])
  const { updateCamera, initCamera } = useCameraChase()

  useEffect(() => {
    initCamera(field.find((k) => k.player).st)
    onPhase?.('countdown')
  }, [field, onPhase])

  useFrame((state, rawDt) => {
    if (paused) return // pause menu open: the race clock and karts freeze
    const dt = Math.min(rawDt, 1 / 30)
    const raceState = race.current
    raceState.t += dt
    const player = field.find((k) => k.player)
    const playerKart = player.st

    stepCountdownLights(raceState, track, onPhase)
    const racing = raceState.phase !== 'countdown'

    stepAllKarts({ field, track, keys, playerKart, raceState, racing, dt })

    for (const racer of field) {
      const kartState = racer.st
      kartState.progress = kartState.raceDist + kartState.offset
      if (!practice && !kartState.finished && kartState.progress >= LAPS * LAP_LENGTH && racing) {
        kartState.finished = true; kartState.finishTime = raceState.t - raceState.raceStart
        raceState.results.push({ name: racer.name, time: kartState.finishTime, player: !!racer.player, paint: racer.paint })
        if (racer.player) { raceState.phase = 'finished'; onPhase?.('finished'); onFinish?.(raceState.results.slice(), field) }
        else if (playerKart.finished) onFinish?.(raceState.results.slice(), field)
      }
    }
    // practice (Test Track): endless laps, no finish
    const lapNumber = Math.max(1, Math.floor(playerKart.progress / LAP_LENGTH) + 1)
    const currentLap = practice ? lapNumber : Math.min(LAPS, lapNumber)
    if (racing && !playerKart.finished && currentLap !== raceState.lastLap) {
      const lapTime = raceState.t - raceState.lapStart
      raceState.lapTimes.push(lapTime); raceState.best = raceState.best == null ? lapTime : Math.min(raceState.best, lapTime)
      raceState.lapStart = raceState.t; raceState.lastLap = currentLap
      if (practice) {
        const record = recordPracticeLap(lapTime)
        raceState.flash = { text: record ? `NEW BEST ${lapTime.toFixed(2)}s!` : `LAP ${lapTime.toFixed(2)}s`, until: raceState.t + 2 }
      } else raceState.flash = { text: currentLap === LAPS ? 'FINAL LAP!' : `LAP ${currentLap}`, until: raceState.t + 1.6 }
    }

    const elapsed = state.clock.elapsedTime
    for (const racer of field) {
      const { st: kartState, kart } = racer
      kart.root.position.set(kartState.pos.x, 0, kartState.pos.z)
      kart.root.rotation.y = kartState.yaw
      const speedNorm = Math.min(Math.abs(kartState.speed) / 10, 1)
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

    updateCamera({ playerKart, raceState, sun, dt })
    raceState.hudT += dt
    updateHud({ hudElements: hud.current, field, finishOrderCache, player, playerKart, raceState, currentLap, racing, practice })
  })
}
