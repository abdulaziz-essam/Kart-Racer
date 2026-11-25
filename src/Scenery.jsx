import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { locate, pointAt, curvatureAt, LAP_LENGTH, WALL_LIMIT } from './game/path'

// Everything here is instanced: thousands of details for a handful of draw calls.

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// keep the pit building, grandstand and start gantry area clear
const nearPits = (x, z) => x > 160 && x < 290 && z > -70 && z < 70
const clearOfTrack = (x, z, min) => Math.abs(locate(x, z).lat) > min

/* ---------- geometries ---------- */
function blob(parts) {
  return mergeGeometries(parts.map(([r, x, y, z, sy = 1]) => {
    const g = new THREE.SphereGeometry(r, 12, 8)
    g.scale(1, sy, 1); g.translate(x, y, z)
    return g
  }))
}
const G = {
  trunk: new THREE.CylinderGeometry(0.28, 0.4, 3.2, 7).translate(0, 1.6, 0),
  crown: blob([[2.3, 0, 4.6, 0], [1.6, 1.3, 3.9, 0.3], [1.7, -1.2, 4.0, -0.4], [1.5, 0.2, 5.8, -0.9]]),
  pine: mergeGeometries([
    new THREE.ConeGeometry(2.4, 3.4, 9).translate(0, 3.2, 0),
    new THREE.ConeGeometry(1.9, 3.0, 9).translate(0, 4.9, 0),
    new THREE.ConeGeometry(1.3, 2.6, 9).translate(0, 6.5, 0),
  ]),
  bush: blob([[0.9, 0, 0.5, 0, 0.8], [0.7, 0.7, 0.4, 0.2, 0.8], [0.65, -0.6, 0.4, -0.2, 0.8]]),
  tuft: new THREE.ConeGeometry(0.12, 0.7, 3).translate(0, 0.35, 0),
  flower: mergeGeometries([
    new THREE.CylinderGeometry(0.02, 0.02, 0.45, 3).translate(0, 0.22, 0),
    new THREE.SphereGeometry(0.11, 6, 4).scale(1, 0.6, 1).translate(0, 0.47, 0),
  ]),
  tire: new THREE.TorusGeometry(0.42, 0.2, 7, 14).rotateX(Math.PI / 2).translate(0, 0.2, 0),
  rock: new THREE.DodecahedronGeometry(1, 0),
  puff: new THREE.SphereGeometry(1, 14, 10),
  pole: new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6).translate(0, 2.25, 0),
  banner: new THREE.PlaneGeometry(1.6, 0.9).translate(0.8, 3.9, 0),
}

const M = {
  trunk: new THREE.MeshStandardMaterial({ color: '#7a4a26', roughness: 0.9 }),
  leaves: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#e4ffb0'), sheenRoughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
  grass: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
  flower: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
  tire: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.45, clearcoat: 0.6 }),
  rock: new THREE.MeshStandardMaterial({ color: '#a9a39a', roughness: 0.85, flatShading: true }),
  cloud: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e4efff', emissiveIntensity: 0.5, roughness: 1, fog: false }),
  pole: new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 0.6, roughness: 0.3 }),
  banner: new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6 }),
}

/* ---------- instance layouts ---------- */
function useLayout(blenderTrees) {
  return useMemo(() => {
    const r = rng(1337)
    const out = { round: [], pine: [], bush: [], tuft: [], flower: [], tire: [], rock: [], cloud: [], flag: [] }
    const scatter = (count, minLat, maxR, fn) => {
      for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * maxR
        const x = Math.cos(a) * d, z = Math.sin(a) * d
        if (nearPits(x, z) || !clearOfTrack(x, z, minLat)) continue
        fn(x, z); i++
      }
    }
    // trees: Blender positions + extra forest, mixing round trees and pines
    for (const t of blenderTrees) if (!nearPits(t.x, t.z) && clearOfTrack(t.x, t.z, 20)) (r() < 0.6 ? out.round : out.pine).push([t.x, t.z, t.s * (0.9 + r() * 0.3), r() * 6.28])
    scatter(220, 22, 470, (x, z) => (r() < 0.55 ? out.round : out.pine).push([x, z, 0.8 + r() * 0.7, r() * 6.28]))
    // bushes hugging the outside of the barriers
    for (let s = 0; s < LAP_LENGTH; s += 7) {
      const side = r() < 0.5 ? -1 : 1
      const p = pointAt(s + r() * 4, side * (WALL_LIMIT + 3.5 + r() * 5))
      if (!nearPits(p.x, p.z)) out.bush.push([p.x, p.z, 0.8 + r() * 0.8, r() * 6.28])
    }
    // grass tufts and flower patches near the track
    for (let s = 0; s < LAP_LENGTH; s += 0.55) {
      const side = r() < 0.5 ? -1 : 1
      const p = pointAt(s, side * (WALL_LIMIT + 2.2 + r() * r() * 30))
      if (!nearPits(p.x, p.z)) out.tuft.push([p.x, p.z, 0.6 + r() * 0.9, r() * 6.28])
    }
    for (let k = 0; k < 90; k++) { // flower patches
      const s = r() * LAP_LENGTH, side = r() < 0.5 ? -1 : 1, lat = side * (WALL_LIMIT + 4 + r() * 25)
      const c = pointAt(s, lat)
      if (nearPits(c.x, c.z)) continue
      const hue = [0.0, 0.13, 0.58, 0.83, 0.08][k % 5]
      for (let j = 0; j < 22; j++) out.flower.push([c.x + (r() - 0.5) * 5, c.z + (r() - 0.5) * 5, 0.8 + r() * 0.6, r() * 6.28, hue])
    }
    // tyre walls on the outside of tight corners (red/white stacks of 3)
    let stack = 0
    for (let s = 0; s < LAP_LENGTH; s += 2.2) {
      const c = curvatureAt(s)
      if (Math.abs(c) < 0.012) continue
      const p = pointAt(s, -Math.sign(c) * (WALL_LIMIT + 1.6))
      if (nearPits(p.x, p.z)) continue
      for (let h = 0; h < 3; h++) out.tire.push([p.x, p.z, h, (stack + h) % 2])
      stack++
    }
    // flag poles along the straights
    for (let s = 20; s < LAP_LENGTH; s += 36) {
      if (Math.abs(curvatureAt(s)) > 0.006) continue
      for (const side of [-1, 1]) {
        const p = pointAt(s, side * (WALL_LIMIT + 1.4))
        if (!nearPits(p.x, p.z)) out.flag.push([p.x, p.z, side, s])
      }
    }
    scatter(70, 26, 430, (x, z) => out.rock.push([x, z, 0.5 + r() * 1.6, r() * 6.28]))
    // clouds
    for (let c = 0; c < 26; c++) {
      const a = (c / 26) * Math.PI * 2 + r() * 0.2, R = 520 + r() * 260, y = 90 + r() * 70
      const cx = Math.cos(a) * R, cz = Math.sin(a) * R
      for (let p = 0; p < 6; p++) out.cloud.push([cx + (r() - 0.5) * 60, y + r() * 10, cz + (r() - 0.5) * 25, 12 + r() * 14])
    }
    return out
  }, [blenderTrees])
}

function Instances({ geometry, material, items, place, color, castShadow = true, receiveShadow = true }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Object3D(), c = new THREE.Color()
    items.forEach((it, i) => {
      place(m, it); m.updateMatrix(); ref.current.setMatrixAt(i, m.matrix)
      if (color) ref.current.setColorAt(i, color(c, it, i))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items, place, color])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} />
}

const ground = (m, [x, z, s, rot]) => { m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.set(0, rot, 0) }
const leafColor = (base, spread) => (c, it, i) => c.setHSL(base + ((i * 0.618) % 1) * spread, 0.62, 0.36 + ((i * 0.37) % 1) * 0.12)

export default function Scenery({ trees }) {
  const L = useLayout(trees)
  const clouds = useRef()
  const flags = useRef()
  useFrame((state, dt) => {
    if (clouds.current) clouds.current.rotation.y += dt * 0.003
    if (flags.current) {
      const t = state.clock.elapsedTime
      flags.current.children.forEach((f, i) => { f.rotation.y = f.userData.base + Math.sin(t * 2.3 + i) * 0.25 })
    }
  })
  const flagColors = ['#ff3b30', '#ffcc00', '#1f7aff', '#2ecc71', '#ff7a00', '#c83cff']
  return (
    <group>
      <Instances geometry={G.trunk} material={M.trunk} items={L.round} place={ground} />
      <Instances geometry={G.crown} material={M.leaves} items={L.round} place={ground} color={leafColor(0.24, 0.08)} />
      <Instances geometry={G.trunk} material={M.trunk} items={L.pine} place={ground} />
      <Instances geometry={G.pine} material={M.leaves} items={L.pine} place={ground} color={(c, it, i) => c.setHSL(0.36 + ((i * 0.618) % 1) * 0.05, 0.55, 0.26 + ((i * 0.37) % 1) * 0.08)} />
      <Instances geometry={G.bush} material={M.leaves} items={L.bush} place={ground} color={leafColor(0.26, 0.07)} />
      <Instances geometry={G.tuft} material={M.grass} items={L.tuft} place={ground} castShadow={false}
        color={(c, it, i) => c.setHSL(0.25 + ((i * 0.618) % 1) * 0.06, 0.6, 0.3 + ((i * 0.31) % 1) * 0.15)} />
      <Instances geometry={G.flower} material={M.flower} items={L.flower} place={ground} castShadow={false}
        color={(c, it) => c.setHSL(it[4], 0.85, 0.6)} />
      <Instances geometry={G.tire} material={M.tire} items={L.tire}
        place={(m, [x, z, h]) => { m.position.set(x, h * 0.4, z); m.scale.setScalar(1); m.rotation.set(0, 0, 0) }}
        color={(c, it) => c.set(it[3] ? '#f4f4f4' : '#e8231c')} />
      <Instances geometry={G.rock} material={M.rock} items={L.rock}
        place={(m, [x, z, s, rot]) => { m.position.set(x, s * 0.25, z); m.scale.set(s, s * 0.65, s * 0.9); m.rotation.set(rot * 0.3, rot, 0) }} />
      <group ref={clouds}>
        <Instances geometry={G.puff} material={M.cloud} items={L.cloud} castShadow={false} receiveShadow={false}
          place={(m, [x, y, z, s]) => { m.position.set(x, y, z); m.scale.set(s * 1.4, s * 0.75, s); m.rotation.set(0, 0, 0) }} />
      </group>
      <Instances geometry={G.pole} material={M.pole} items={L.flag}
        place={(m, [x, z]) => { m.position.set(x, 0, z); m.scale.setScalar(1); m.rotation.set(0, 0, 0) }} />
      <group ref={flags}>
        {L.flag.map(([x, z, side, s], i) => {
          const base = Math.atan2(-(pointAt(s + 2).z - pointAt(s).z), pointAt(s + 2).x - pointAt(s).x) + Math.PI
          return (
            <mesh key={i} geometry={G.banner} position={[x, 0, z]} rotation={[0, base, 0]} userData={{ base }} castShadow>
              <meshStandardMaterial color={flagColors[i % flagColors.length]} side={THREE.DoubleSide} roughness={0.6} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
