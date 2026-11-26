import { COUNTDOWN } from '../game/constants'

export function stepCountdownLights(raceState, track, onPhase) {
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
}
