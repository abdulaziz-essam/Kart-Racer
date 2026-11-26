import * as THREE from 'three'
import { useMemo } from 'react'
import { pointAt, curvatureAt, LAP_LENGTH, ROAD_HALF, KERB_OUT, VERGE_OUT, lapGap } from './game/path'
import { currentTheme } from './game/themes'
import { LINE_S, gridSlot } from './game/constants'
import { addWorldNoise } from './materials'

// The road is generated from the racing line, so its width and markings
// are independent of the Blender mesh: asphalt, painted lines, raised kerbs,
// striped grass verges, a chequered start line and grid boxes.

const STEP = 1.5 // metres between cross-sections

/**
 * A strip between two lateral offsets following the racing line.
 * yA/yB: height of each edge; color(s, i): per-segment colour (or null).
 * from/to: limit to a stretch of the lap (default: full loop).
 */
function ribbon({ latA, latB, yA = 0.02, yB = 0.02, color = null, from = 0, to = LAP_LENGTH, step = STEP, keep = () => true }) {
  const pos = [], col = []
  const a0 = new THREE.Vector3(), b0 = new THREE.Vector3(), a1 = new THREE.Vector3(), b1 = new THREE.Vector3()
  const c = new THREE.Color()
  let i = 0
  for (let s = from; s < to - 1e-6; s += step, i++) {
    const s1 = Math.min(s + step, to)
    if (!keep(s, i)) continue
    pointAt(s, latA, a0); pointAt(s, latB, b0); pointAt(s1, latA, a1); pointAt(s1, latB, b1)
    a0.y = a1.y = yA; b0.y = b1.y = yB
    // two triangles, wound so the face points up whichever side we are on
    const quad = latA < latB ? [a0, a1, b1, a0, b1, b0] : [a0, b1, a1, a0, b0, b1]
    for (const v of quad) pos.push(v.x, v.y, v.z)
    if (color) { color(c, s, i); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** Small flat rectangle on the road: centre at (s, lat), size along x across. */
function patch(s, lat, along, across, y, out, color) {
  const a = pointAt(s - along / 2, lat - across / 2), b = pointAt(s + along / 2, lat - across / 2)
  const c = pointAt(s + along / 2, lat + across / 2), d = pointAt(s - along / 2, lat + across / 2)
  for (const v of [a, c, b, a, d, c]) out.pos.push(v.x, y, v.z)
  if (color) for (let k = 0; k < 6; k++) out.col.push(color.r, color.g, color.b)
}
function patchGeometry(out) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
  if (out.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3))
  g.computeVertexNormals()
  return g
}

const decal = (props) => ({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...props })

export default function TrackSurface() {
  const parts = useMemo(() => {
    const red = new THREE.Color('#e3261c'), white = new THREE.Color('#f4f4f4')
    const [g1, g2] = currentTheme().verge.map((c) => new THREE.Color(c))

    // --- asphalt ---
    const asphalt = ribbon({ latA: -ROAD_HALF - 0.05, latB: ROAD_HALF + 0.05, yA: 0.02, yB: 0.02 })
    const asphaltMat = new THREE.MeshPhysicalMaterial({ color: '#3c3f49', roughness: 0.82 })
    addWorldNoise(asphaltMat, { large: 0.03, fine: 3.2, largeAmt: 0.3, fineAmt: 0.22, rough: 0.3 })

    // --- kerbs: raised red/white blocks on both sides, flat over the road edge ---
    const kerbColor = (c, s) => c.copy(Math.floor(s / 3) % 2 ? red : white)
    const kerbs = [
      ribbon({ latA: ROAD_HALF, latB: KERB_OUT, yA: 0.03, yB: 0.13, color: kerbColor }),
      ribbon({ latA: -ROAD_HALF, latB: -KERB_OUT, yA: 0.03, yB: 0.13, color: kerbColor }),
      // outer lip down to the grass
      ribbon({ latA: KERB_OUT, latB: KERB_OUT + 0.25, yA: 0.13, yB: 0.0, color: kerbColor }),
      ribbon({ latA: -KERB_OUT, latB: -KERB_OUT - 0.25, yA: 0.13, yB: 0.0, color: kerbColor }),
    ]

    // --- painted lines: solid edges, dashed centre ---
    const lines = [
      ribbon({ latA: ROAD_HALF - 0.75, latB: ROAD_HALF - 0.4, yA: 0.025, yB: 0.025 }),
      ribbon({ latA: -ROAD_HALF + 0.4, latB: -ROAD_HALF + 0.75, yA: 0.025, yB: 0.025 }),
      ribbon({ latA: -0.18, latB: 0.18, yA: 0.025, yB: 0.025, step: 3, keep: (s, i) => i % 3 === 0 && lapGap(s, LINE_S) > 12 }),
    ]

    // --- striped mown-grass verges (wider stripes on the outside of corners) ---
    const stripe = (c, s) => c.copy(Math.floor(s / 6) % 2 ? g1 : g2)
    const verges = [
      ribbon({ latA: KERB_OUT + 0.25, latB: VERGE_OUT, yA: 0.005, yB: 0.005, color: stripe, step: 3 }),
      ribbon({ latA: -KERB_OUT - 0.25, latB: -VERGE_OUT, yA: 0.005, yB: 0.005, color: stripe, step: 3 }),
    ]

    // --- start/finish chequers + grid boxes ---
    const chk = { pos: [], col: [] }
    const cell = 1.2
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k * cell < ROAD_HALF * 2; k++) {
        const lat = -ROAD_HALF + cell / 2 + k * cell
        patch(LINE_S + (row - 0.5) * cell, lat, cell, cell, 0.03, chk, (k + row) % 2 ? white : new THREE.Color('#15161a'))
      }
    }
    const grid = { pos: [], col: [] }
    for (let slot = 0; slot < 6; slot++) {
      const { s, lat } = gridSlot(slot)
      const front = s + 2.2
      patch(front, lat, 0.3, 3.4, 0.028, grid)            // front bar
      patch(s, lat + 1.6, 4.4, 0.25, 0.028, grid)         // side bars
      patch(s, lat - 1.6, 4.4, 0.25, 0.028, grid)
    }

    // --- subtle darker racing line through the corners (rubber laid down) ---
    const rubber = ribbon({
      latA: -2.2, latB: 2.2, yA: 0.022, yB: 0.022, step: 3,
      keep: (s) => Math.abs(curvatureAt(s)) > 0.004,
    })

    return { asphalt, asphaltMat, kerbs, lines, verges, checker: patchGeometry(chk), grid: patchGeometry(grid), rubber }
  }, [])

  return (
    <group>
      <mesh geometry={parts.asphalt} material={parts.asphaltMat} receiveShadow />
      <mesh geometry={parts.rubber} receiveShadow>
        <meshStandardMaterial color="#1c1d22" roughness={0.6} transparent opacity={0.35} depthWrite={false} {...decal()} />
      </mesh>
      {parts.lines.map((g, i) => (
        <mesh key={'l' + i} geometry={g} receiveShadow>
          <meshStandardMaterial color="#f2f2ee" roughness={0.55} {...decal()} />
        </mesh>
      ))}
      {parts.kerbs.map((g, i) => (
        <mesh key={'k' + i} geometry={g} receiveShadow castShadow={false}>
          <meshStandardMaterial vertexColors roughness={0.6} />
        </mesh>
      ))}
      {parts.verges.map((g, i) => (
        <mesh key={'v' + i} geometry={g} receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.95} {...decal()} />
        </mesh>
      ))}
      <mesh geometry={parts.checker} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.5} {...decal({ polygonOffsetFactor: -3, polygonOffsetUnits: -3 })} />
      </mesh>
      <mesh geometry={parts.grid} receiveShadow>
        <meshStandardMaterial color="#f2f2ee" roughness={0.55} {...decal({ polygonOffsetFactor: -3, polygonOffsetUnits: -3 })} />
      </mesh>
    </group>
  )
}
