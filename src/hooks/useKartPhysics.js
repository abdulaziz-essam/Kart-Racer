import { stepKart, detectSurface, collideKarts, collideBoxes } from '../game/physics'
import { aiInput } from '../game/ai'
import { pointAt, yawAt } from '../game/path'

export function stepAllKarts({ field, track, keys, playerKart, raceState, racing, dt }) {
  const input = keys.current
  if (input.reset && racing) {
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
}
