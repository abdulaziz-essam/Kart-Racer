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
  const T = TUNING
  const surf = T[st.surface]
  // drift boost: hold a drift for 0.8 s, release for a short burst of speed
  if (st.drifting) st.driftTime = (st.driftTime || 0) + dt
  else if (st.driftTime) { if (st.driftTime > 0.8) st.boost = Math.min(1.4, 0.5 + st.driftTime * 0.5); st.driftTime = 0 }
  st.boost = Math.max(0, (st.boost || 0) - dt)
  const boosting = st.boost > 0
  const max = surf.max * st.maxMul * (boosting ? 1.3 : 1)
  if (boosting && st.speed > 0) st.speed += 12 * dt

  if (input.up) st.speed += (st.speed < 0 ? T.brake : T.accel) * dt
  else if (input.down) st.speed -= (st.speed > 0 ? T.brake : T.accel) * dt
  else st.speed -= Math.sign(st.speed) * Math.min(Math.abs(st.speed), (T.drag + Math.abs(st.speed) * 0.25) * dt)
  if (st.speed > max) st.speed = THREE.MathUtils.damp(st.speed, max, 3, dt)
  st.speed = Math.max(st.speed, -T.reverseMax)

  const target = input.steer ?? ((input.left ? 1 : 0) - (input.right ? 1 : 0))
  st.steer = THREE.MathUtils.damp(st.steer, target, 10, dt)
  const drifting = input.drift && Math.abs(st.speed) > 8
  const speedFactor = Math.min(Math.abs(st.speed) / 8, 1) * (st.speed < 0 ? -1 : 1)
  st.yaw += st.steer * (drifting ? T.driftSteer : T.steer) * speedFactor * dt
  let d = st.yaw - st.velYaw
  d = Math.atan2(Math.sin(d), Math.cos(d))
  st.velYaw += d * Math.min(1, (drifting ? T.driftGrip : surf.grip) * dt)
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
  const R = TUNING.radius
  for (const b of boxes) {
    const dx = st.pos.x - b.x, dz = st.pos.z - b.z
    if (Math.abs(dx) > b.reach || Math.abs(dz) > b.reach) continue
    // into the box's local frame
    const lx = dx * b.cos + dz * b.sin, lz = -dx * b.sin + dz * b.cos
    const cx = THREE.MathUtils.clamp(lx, -b.hx, b.hx), cz = THREE.MathUtils.clamp(lz, -b.hz, b.hz)
    let nx = lx - cx, nz = lz - cz
    let d = Math.hypot(nx, nz)
    if (d >= R) continue
    if (d < 1e-4) { // centre inside the box: push out through the nearest face
      const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz)
      if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; d = -px } else { nx = 0; nz = Math.sign(lz) || 1; d = -pz }
    } else { nx /= d; nz /= d }
    const push = R - d
    st.pos.x += (nx * b.cos - nz * b.sin) * push
    st.pos.z += (nx * b.sin + nz * b.cos) * push
    st.speed *= 0.6; st.bump = 0.25
  }
}

/** Simple circle-vs-circle bumping between karts. */
export function collideKarts(states) {
  const R = TUNING.radius * 2
  for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
    const a = states[i], b = states[j]
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z
    const d2 = dx * dx + dz * dz
    if (d2 >= R * R || d2 < 1e-6) continue
    const d = Math.sqrt(d2), push = (R - d) / 2, nx = dx / d, nz = dz / d
    a.pos.x -= nx * push; a.pos.z -= nz * push
    b.pos.x += nx * push; b.pos.z += nz * push
    // the kart behind loses a little speed, the one in front gets nudged
    const fa = Math.cos(a.velYaw) * nx - Math.sin(a.velYaw) * nz // >0: a is driving into b
    if (fa > 0) { a.speed *= 0.93; b.speed = Math.max(b.speed, a.speed * 0.95) }
    else { b.speed *= 0.93; a.speed = Math.max(a.speed, b.speed * 0.95) }
    a.bump = b.bump = 0.2
  }
}
