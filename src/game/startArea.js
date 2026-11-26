import { locate, pointAt, yawAt, KERB_OUT } from './path'

// Where the grandstand goes on the current track. On tight layouts another
// stretch of road can run right behind the start straight, so we try both
// sides and a few sizes, and keep the biggest stand whose whole footprint
// (plus a margin) stays clear of every part of the circuit.

export const STAND_ROW_DEPTH = 2.6
export const STAND_ROW_RISE = 1.1
const GAP = 10 // metres between the kerb and the front row

const loc = {}
/** Is every point of this box at least `margin` metres beyond the kerbs of any road section? */
function clearOfRoad(cx, cz, yaw, halfLen, halfDepth, margin) {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw) // along the stand
  const rx = Math.sin(yaw), rz = Math.cos(yaw)  // towards the back of the stand (right of travel)
  for (let a = -1; a <= 1.001; a += 0.25) for (let b = -1; b <= 1.001; b += 0.5) {
    const x = cx + fx * a * halfLen + rx * b * halfDepth, z = cz + fz * a * halfLen + rz * b * halfDepth
    if (Math.abs(locate(x, z, -1, loc).lat) < KERB_OUT + margin) return false
  }
  return true
}

/**
 * Returns { side, lat, length, rows, centreLat } for the stand at the start line,
 * or null if nothing fits. side -1 = right of the direction of travel, +1 = left.
 */
export function chooseStand() {
  const yaw = yawAt(0)
  for (const [length, rows] of [[72, 6], [56, 5], [42, 4], [30, 3]]) {
    for (const side of [-1, 1]) {
      const depth = rows * STAND_ROW_DEPTH
      const front = KERB_OUT + GAP
      const centreLat = side * (front + depth / 2)
      const c = pointAt(0, centreLat)
      if (clearOfRoad(c.x, c.z, yaw, length / 2 + 2, depth / 2 + 2, 4)) {
        return { side, lat: side * front, length, rows, centreLat }
      }
    }
  }
  return null
}
