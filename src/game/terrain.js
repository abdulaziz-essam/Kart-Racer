import * as THREE from 'three'
import { locate, pointAt, VERGE_OUT, TRACK, POINTS } from './path'
import { currentTheme } from './themes'

// Sculpted landscape around the current circuit. The road stays at y = 0
// (physics is flat); the ground is flat near the track and the start area,
// rises into banks just past the verges, then hills further out. Each venue's
// theme sets the colours and how hilly it is; Lakeside gets a lake in the infield.

const FLAT = VERGE_OUT + 6      // fully flat up to here (metres from the racing line)
const HILLS = VERGE_OUT + 160   // hills reach full height only far away: gentle slopes, nothing wall-like
export const WATER_LEVEL = -1.3

let cacheFor = null, info = null
/** Per-track layout numbers (centre, size, start point, lake), recomputed when the track changes. */
export function terrainInfo() {
  if (cacheFor === TRACK) return info
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, cx = 0, cz = 0
  for (const p of POINTS) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y)
    cx += p.x; cz += p.y
  }
  cx /= POINTS.length; cz /= POINTS.length
  const half = Math.max(maxX - minX, maxZ - minZ) / 2
  const centre = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }
  const start = pointAt(0)
  // lake in the infield: the biggest open circle inside the loop, clear of the road
  const theme = currentTheme()
  let lake = null
  if (theme.lake) {
    const inside = (x, z) => { // even-odd point-in-polygon on the racing line
      let c = false
      for (let i = 0, j = POINTS.length - 1; i < POINTS.length; j = i++) {
        const a = POINTS[i], b = POINTS[j]
        if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c
      }
      return c
    }
    let best = { x: cx, z: cz, clear: 0 }
    for (let x = minX; x <= maxX; x += 12) for (let z = minZ; z <= maxZ; z += 12) {
      if (!inside(x, z)) continue
      let clear = Infinity
      for (const p of POINTS) { clear = Math.min(clear, Math.hypot(p.x - x, p.y - z)); if (clear < best.clear) break }
      if (clear > best.clear) best = { x, z, clear }
    }
    if (best.clear > 70) lake = { x: best.x, z: best.z, r: best.clear - FLAT - 25 }
  }
  info = { centre, size: (half + 420) * 2, rimFrom: half + 260, start, lake, theme }
  cacheFor = TRACK
  return info
}

// cheap smooth noise from layered sines (deterministic, no textures)
function waves(x, z) {
  return (
    Math.sin(x * 0.0105 + 1.3) * Math.cos(z * 0.0087 - 0.7) * 0.55 +
    Math.sin(x * 0.0041 - z * 0.0058 + 2.1) * 0.8 +
    Math.sin(z * 0.017 + x * 0.0023) * 0.3 +
    Math.cos(x * 0.026 - z * 0.021) * 0.12
  ) / 1.77 * 0.5 + 0.5 // ~0..1
}

const loc = {}
/** Ground height at (x, z). `lat` (distance from the racing line) can be passed if known. */
export function heightAt(x, z, lat) {
  const T = terrainInfo()
  const d = lat ?? Math.abs(locate(x, z, -1, loc).lat)
  // the start straight (grid, gantry, grandstand) stays flat
  const startFlat = THREE.MathUtils.smoothstep(Math.hypot(x - T.start.x, z - T.start.z), 90, 150)
  const away = THREE.MathUtils.smoothstep(d, FLAT, HILLS) * startFlat
  const r = Math.hypot(x - T.centre.x, z - T.centre.z)
  const hills = Math.pow(waves(x, z), 1.6) * (T.theme.hills + THREE.MathUtils.smoothstep(r, T.rimFrom - 300, T.rimFrom + 150) * T.theme.farHills)
  const rim = Math.max(0, r - T.rimFrom) * 0.35
  let h = away * hills + rim - 0.05
  if (T.lake) {
    const lr = Math.hypot(x - T.lake.x, z - T.lake.z)
    const basin = 1 - THREE.MathUtils.smoothstep(lr, T.lake.r * 0.75, T.lake.r * 1.15)
    h = THREE.MathUtils.lerp(h, WATER_LEVEL - 3, basin * THREE.MathUtils.smoothstep(d, FLAT + 10, FLAT + 30))
  }
  return h
}

/** Ground colour from the venue theme: darker hollows, lighter tops, dry patches, sandy shores. */
export function groundColor(c, x, z, h) {
  const { ground: g, dryHue } = terrainInfo().theme
  const t = THREE.MathUtils.clamp(h / 30, 0, 1)
  const dry = THREE.MathUtils.smoothstep(waves(z * 1.7 + 300, x * 1.7 - 200), 0.72, 0.9)
  c.setHSL(g.hue - t * 0.03 + dry * dryHue, g.sat - dry * 0.15, g.light + t * 0.07 + dry * 0.06)
  if (h < WATER_LEVEL + 0.8) c.lerp(new THREE.Color('#d8c48c'), THREE.MathUtils.clamp((WATER_LEVEL + 0.8 - h) / 1.5, 0, 1))
  return c
}

/** Build the terrain mesh geometry for the current track (done once per race). */
export function buildTerrainGeometry(segments = 220) {
  const T = terrainInfo()
  const g = new THREE.PlaneGeometry(T.size, T.size, segments, segments)
  g.rotateX(-Math.PI / 2)
  g.translate(T.centre.x, 0, T.centre.z)
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  let hint = -1
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    // rows are walked in order, so the previous nearest segment is a good hint;
    // fall back to a full search at the start of each row
    const l = locate(x, z, i % (segments + 1) === 0 ? -1 : hint, loc)
    hint = l.i
    const h = heightAt(x, z, Math.abs(l.lat))
    pos.setY(i, h)
    groundColor(c, x, z, h)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}
