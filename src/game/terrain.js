import * as THREE from 'three'
import { locate, VERGE_OUT, WORLD_SCALE } from './path'

// Sculpted landscape around the circuit. The road stays at y = 0 (physics is
// flat); the ground is flat near the track and the start area, rises into
// grassy banks just past the verges, then rolling hills further out.

export const TERRAIN_SIZE = 1900
const FLAT = VERGE_OUT + 3      // fully flat up to here (metres from the racing line)
const HILLS = VERGE_OUT + 70    // hills reach full height by here

// start area (grandstand, gantry, grid): kept flat too
const START = { x0: 170 * WORLD_SCALE, x1: 285 * WORLD_SCALE, z0: -60 * WORLD_SCALE, z1: 60 * WORLD_SCALE }
const startFlat = (x, z) => {
  const dx = Math.max(START.x0 - x, 0, x - START.x1), dz = Math.max(START.z0 - z, 0, z - START.z1)
  return THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 0, 40)
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
  const d = lat ?? Math.abs(locate(x, z, -1, loc).lat)
  const away = THREE.MathUtils.smoothstep(d, FLAT, HILLS) * startFlat(x, z)
  // low grassy bank hugging the verge
  const bank = Math.exp(-(((d - FLAT - 5) / 4) ** 2)) * 1.4 * startFlat(x, z)
  // rolling hills, taller far out; a bowl at the map edge hides the horizon
  const r = Math.hypot(x, z)
  const hills = Math.pow(waves(x, z), 1.6) * (14 + THREE.MathUtils.smoothstep(r, 350, 800) * 26)
  const rim = Math.max(0, r - 760) * 0.35
  return bank + away * hills + rim - 0.05
}

/** Ground colour: deeper green in hollows, lighter on hill tops, a little dry grass. */
export function groundColor(c, x, z, h) {
  const t = THREE.MathUtils.clamp(h / 28, 0, 1)
  const dry = THREE.MathUtils.smoothstep(waves(z * 1.7 + 300, x * 1.7 - 200), 0.72, 0.9)
  c.setHSL(0.28 - t * 0.03 - dry * 0.06, 0.55 - dry * 0.15, 0.24 + t * 0.07 + dry * 0.06)
  return c
}

/** Build the terrain mesh geometry (done once at load). */
export function buildTerrainGeometry(segments = 220) {
  const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  let hint = -1
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    // walking the grid row by row, so the previous nearest segment is a good hint,
    // but rows jump; fall back to a full search at the start of each row
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
