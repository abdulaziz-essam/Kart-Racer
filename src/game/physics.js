import * as THREE from 'three'
import { locate, WALL_LIMIT, KERB_OUT, VERGE_OUT, LAP_LENGTH } from './path'

export const TUNING = {
  road: { max: 30, grip: 9 },
  runoff: { max: 22, grip: 6.5 }, // striped grass verge just off the kerbs
  grass: { max: 12, grip: 4 },
  accel: 15, brake: 30, reverseMax: 9, drag: 0.6,
  steer: 2.0, driftSteer: 2.9, driftGrip: 2.2,
  radius: 1.35, // kart-vs-kart and kart-vs-post radius
}

/** Fresh physics state for a kart placed at `pos` facing `yaw`. */
export function createKartState(pos, yaw, extra = {}) {
  const st = {
    pos: pos.clone(), yaw, velYaw: yaw, speed: 0, steer: 0, maxMul: 1,
    surface: 'road', loc: locate(pos.x, pos.z, -1), hint: 0,
    raceDist: 0, lastDist: 0, finished: false, finishTime: 0, bump: 0,
    ...extra,
  }
  st.hint = st.loc.i
  st.lastDist = st.loc.dist
  return st
}

/** Surface from the circuit cross-section: road + kerbs, verge, then grass. */
export function detectSurface(st) {
  const a = Math.abs(st.loc.lat)
  return a < KERB_OUT ? 'road' : a < VERGE_OUT ? 'runoff' : 'grass'
}

/**
 * Advance one kart. input = { up, down, left, right, drift } (steer may also be
 * given directly as input.steer in [-1, 1] for AI).
 */
export function stepKart(st, input, dt) {
  const surf = TUNING[st.surface]
  // drift boost: hold a drift for 0.8 s, release for a short burst of speed
  if (st.drifting) st.driftTime = (st.driftTime || 0) + dt
  else if (st.driftTime) { if (st.driftTime > 0.8) st.boost = Math.min(1.4, 0.5 + st.driftTime * 0.5) * (st.boostMul ?? 1); st.driftTime = 0 }
  st.boost = Math.max(0, (st.boost || 0) - dt)
  const boosting = st.boost > 0
  // per-kart car stats / upgrades (player garage); AI karts use 1
  const maxSpeed = surf.max * st.maxMul * (st.speedMul ?? 1) * (boosting ? 1.3 : 1)
  if (boosting && st.speed > 0) st.speed += 12 * dt

  if (input.up) st.speed += (st.speed < 0 ? TUNING.brake : TUNING.accel * (st.accelMul ?? 1)) * dt
  else if (input.down) st.speed -= (st.speed > 0 ? TUNING.brake : TUNING.accel) * dt
  else st.speed -= Math.sign(st.speed) * Math.min(Math.abs(st.speed), (TUNING.drag + Math.abs(st.speed) * 0.25) * dt)
  if (st.speed > maxSpeed) st.speed = THREE.MathUtils.damp(st.speed, maxSpeed, 3, dt)
  st.speed = Math.max(st.speed, -TUNING.reverseMax)

  const target = input.steer ?? ((input.left ? 1 : 0) - (input.right ? 1 : 0))
  st.steer = THREE.MathUtils.damp(st.steer, target, 10, dt)
  const drifting = input.drift && Math.abs(st.speed) > 8
  const speedFactor = Math.min(Math.abs(st.speed) / 8, 1) * (st.speed < 0 ? -1 : 1)
  st.yaw += st.steer * (drifting ? TUNING.driftSteer : TUNING.steer) * speedFactor * dt
  let d = st.yaw - st.velYaw
  d = Math.atan2(Math.sin(d), Math.cos(d))
  st.velYaw += d * Math.min(1, (drifting ? TUNING.driftGrip : surf.grip * (st.gripMul ?? 1)) * dt)
  st.drifting = drifting

  st.pos.x += Math.cos(st.velYaw) * st.speed * dt
  st.pos.z -= Math.sin(st.velYaw) * st.speed * dt

  // where are we on the lap?
  locate(st.pos.x, st.pos.z, st.hint, st.loc)
  st.hint = st.loc.i

  // barriers: keep the kart inside the walls either side of the racing line
  if (Math.abs(st.loc.lat) > WALL_LIMIT) {
    const push = Math.abs(st.loc.lat) - WALL_LIMIT
    const s = Math.sign(st.loc.lat)
    // left normal is (dirZ, -dirX); move back towards the line
    st.pos.x -= st.loc.dirZ * push * s
    st.pos.z += st.loc.dirX * push * s
    // scrape: lose speed, more when hitting square-on
    const heading = Math.atan2(-st.loc.dirZ, st.loc.dirX)
    const into = Math.abs(Math.sin(st.velYaw - heading))
    st.speed *= 1 - Math.min(0.9, into * 1.6) * Math.min(1, dt * 20)
    st.velYaw = THREE.MathUtils.lerp(st.velYaw, st.yaw, 0.5)
    st.bump = 0.25
    st.loc.lat = s * WALL_LIMIT
  }

  // race distance: unwrap the lap position so crossing the line keeps counting up
  let delta = st.loc.dist - st.lastDist
  if (delta < -LAP_LENGTH / 2) delta += LAP_LENGTH
  else if (delta > LAP_LENGTH / 2) delta -= LAP_LENGTH
  st.raceDist += delta
  st.lastDist = st.loc.dist
  st.bump = Math.max(0, st.bump - dt)
}

/**
 * Buildings, stands and gantry legs as oriented boxes on the ground plane.
 * box = { x, z, cos, sin, hx, hz } (centre, rotation, half sizes).
 */
export function collideBoxes(st, boxes) {
  const radius = TUNING.radius
  for (const box of boxes) {
    const dx = st.pos.x - box.x, dz = st.pos.z - box.z
    if (Math.abs(dx) > box.reach || Math.abs(dz) > box.reach) continue
    const localX = dx * box.cos + dz * box.sin, localZ = -dx * box.sin + dz * box.cos
    const closestX = THREE.MathUtils.clamp(localX, -box.hx, box.hx), closestZ = THREE.MathUtils.clamp(localZ, -box.hz, box.hz)
    let nx = localX - closestX, nz = localZ - closestZ
    let dist = Math.hypot(nx, nz)
    if (dist >= radius) continue
    if (dist < 1e-4) {
      const penX = box.hx - Math.abs(localX), penZ = box.hz - Math.abs(localZ)
      if (penX < penZ) { nx = Math.sign(localX) || 1; nz = 0; dist = -penX } else { nx = 0; nz = Math.sign(localZ) || 1; dist = -penZ }
    } else { nx /= dist; nz /= dist }
    const push = radius - dist
    st.pos.x += (nx * box.cos - nz * box.sin) * push
    st.pos.z += (nx * box.sin + nz * box.cos) * push
    st.speed *= 0.6; st.bump = 0.25
  }
}

/** Simple circle-vs-circle bumping between karts. */
export function collideKarts(states) {
  const diameter = TUNING.radius * 2
  for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
    const kartA = states[i], kartB = states[j]
    const dx = kartB.pos.x - kartA.pos.x, dz = kartB.pos.z - kartA.pos.z
    const distSq = dx * dx + dz * dz
    if (distSq >= diameter * diameter || distSq < 1e-6) continue
    const dist = Math.sqrt(distSq), push = (diameter - dist) / 2, nx = dx / dist, nz = dz / dist
    kartA.pos.x -= nx * push; kartA.pos.z -= nz * push
    kartB.pos.x += nx * push; kartB.pos.z += nz * push
    const aFacing = Math.cos(kartA.velYaw) * nx - Math.sin(kartA.velYaw) * nz
    if (aFacing > 0) { kartA.speed *= 0.93; kartB.speed = Math.max(kartB.speed, kartA.speed * 0.95) }
    else { kartB.speed *= 0.93; kartA.speed = Math.max(kartA.speed, kartB.speed * 0.95) }
    kartA.bump = kartB.bump = 0.2
  }
}
