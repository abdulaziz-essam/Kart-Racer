import * as THREE from 'three'
import data from '../trackPath.json'

// Racing line = centre of the road ribbon exported from Blender (x, z pairs),
// ordered in the race direction.
export const POINTS = data.points.map(([x, z]) => new THREE.Vector2(x, z))
export const ROAD_HALF = data.width / 2 // 6 m
export const WALL_LIMIT = 13.2          // max distance of a kart centre from the racing line
const N = POINTS.length

const cum = [0]
for (let i = 0; i < N; i++) cum.push(cum[i] + POINTS[i].distanceTo(POINTS[(i + 1) % N]))
export const LAP_LENGTH = cum[N]

const v = new THREE.Vector2()
const d = new THREE.Vector2()

/**
 * Closest point on the racing line to (x, z).
 * hint: last known segment index (searches nearby), or -1 for a full search.
 * Returns { i, dist (metres along the lap), lat (signed metres from the line, + = left) }.
 */
export function locate(x, z, hint = -1, out = {}) {
  let best = Infinity, bi = 0, bt = 0
  const from = hint < 0 ? 0 : hint - 12, to = hint < 0 ? N : hint + 12
  for (let k = from; k < to; k++) {
    const i = ((k % N) + N) % N
    const a = POINTS[i], b = POINTS[(i + 1) % N]
    d.subVectors(b, a)
    const len2 = d.lengthSq()
    const t = THREE.MathUtils.clamp(((x - a.x) * d.x + (z - a.y) * d.y) / len2, 0, 1)
    const px = a.x + d.x * t - x, pz = a.y + d.y * t - z
    const dd = px * px + pz * pz
    if (dd < best) { best = dd; bi = i; bt = t }
  }
  const a = POINTS[bi], b = POINTS[(bi + 1) % N]
  d.subVectors(b, a).normalize()
  v.set(x - a.x, z - a.y)
  out.i = bi
  out.dist = cum[bi] + (cum[bi + 1] - cum[bi]) * bt
  // forward in three.js is (dx, -dz) in yaw terms; cross > 0 means the point is on the left
  out.lat = -(d.x * v.y - d.y * v.x)
  out.dirX = d.x; out.dirZ = d.y
  return out
}

/** Point on the racing line `s` metres along the lap, shifted `lat` metres to the left. */
export function pointAt(s, lat = 0, out = new THREE.Vector3()) {
  s = ((s % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH
  let lo = 0, hi = N
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m }
  const a = POINTS[lo], b = POINTS[(lo + 1) % N]
  const t = (s - cum[lo]) / (cum[lo + 1] - cum[lo])
  d.subVectors(b, a).normalize()
  // left normal of direction (dx, dz) when yaw-forward is (cos, -sin): (dz, -dx) -> left
  out.set(a.x + (b.x - a.x) * t + d.y * lat, 0, a.y + (b.y - a.y) * t - d.x * lat)
  return out
}

/** Yaw (three.js, forward = (cos yaw, 0, -sin yaw)) of the line at `s`. */
export function yawAt(s) {
  const a = pointAt(s), b = pointAt(s + 2)
  return Math.atan2(-(b.z - a.z), b.x - a.x)
}

/** How sharply the line bends around `s` (radians per metre, signed). */
export function curvatureAt(s, span = 12) {
  let dy = yawAt(s + span) - yawAt(s - span)
  dy = Math.atan2(Math.sin(dy), Math.cos(dy))
  return dy / (2 * span)
}
