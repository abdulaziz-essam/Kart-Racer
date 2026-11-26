import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { heightAt, terrainInfo, WATER_LEVEL } from './game/terrain'
import { locate, pointAt, curvatureAt, LAP_LENGTH, VERGE_OUT, KERB_OUT, offRoad } from './game/path'

const EDGE = VERGE_OUT // outer edge of the striped verge

// Everything here is instanced: thousands of details for a handful of draw calls.

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// keep the start area (gantry, grid, grandstand) clear, and nothing in the lake
const nearPits = (x, z) => {
  const T = terrainInfo()
  if (Math.hypot(x - T.start.x, z - T.start.z) < 95) return true
  return T.lake ? Math.hypot(x - T.lake.x, z - T.lake.z) < T.lake.r * 1.2 : false
}
const clearOfTrack = (x, z, min) => Math.abs(locate(x, z).lat) > min

/* ---------- geometries ---------- */
function blob(parts) {
  return mergeGeometries(parts.map(([r, x, y, z, sy = 1]) => {
    const g = new THREE.SphereGeometry(r, 12, 8)
    g.scale(1, sy, 1); g.translate(x, y, z)
    return g
  }))
}
const GEOMETRIES = {
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

const MATERIALS = {
  trunk: new THREE.MeshStandardMaterial({ color: '#7a4a26', roughness: 0.9 }),
  leaves: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.8, sheen: 0.3, sheenColor: new THREE.Color('#e4ffb0'), sheenRoughness: 0.6 }),
  grass: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
  flower: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
  tire: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }),
  rock: new THREE.MeshStandardMaterial({ color: '#a9a39a', roughness: 0.85, flatShading: true }),
  cloud: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e4efff', emissiveIntensity: 0.5, roughness: 1, fog: false }),
  pole: new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 0.6, roughness: 0.3 }),
  banner: new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6 }),
}

/* ---------- instance layouts ---------- */
function useLayout(blenderTrees) {
  return useMemo(() => {
    const r = rng(1337)
    const T = terrainInfo(), theme = T.theme
    const out = { round: [], pine: [], bush: [], tuft: [], flower: [], tire: [], rock: [], cloud: [], flag: [] }
    const scatter = (count, minLat, maxR, fn) => {
      count = Math.round(count)
      for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * maxR
        const x = T.centre.x + Math.cos(a) * d, z = T.centre.z + Math.sin(a) * d
        if (heightAt(x, z) < WATER_LEVEL + 0.5) continue
        if (nearPits(x, z) || !clearOfTrack(x, z, minLat)) continue
        fn(x, z); i++
      }
    }
    // trees: Blender positions + extra forest, mixing round trees and pines
    for (const t of blenderTrees) if (!nearPits(t.x, t.z) && clearOfTrack(t.x, t.z, EDGE + 9)) (r() < 0.6 ? out.round : out.pine).push([t.x, t.z, t.s * (0.9 + r() * 0.3), r() * 6.28])
    scatter(300 * theme.trees, EDGE + 10, T.size * 0.42, (x, z) => (r() > theme.pines ? out.round : out.pine).push([x, z, 0.8 + r() * 0.7, r() * 6.28]))
    // bushes hugging the outside of the barriers
    for (let s = 0; s < LAP_LENGTH; s += 7) {
      const side = r() < 0.5 ? -1 : 1
      const p = pointAt(s + r() * 4, side * (EDGE + 3 + r() * 6))
      if (!nearPits(p.x, p.z)) out.bush.push([p.x, p.z, 0.8 + r() * 0.8, r() * 6.28])
    }
    // grass tufts and flower patches near the track
    for (let s = 0; s < LAP_LENGTH; s += 0.55) {
      const side = r() < 0.5 ? -1 : 1
      const p = pointAt(s, side * (EDGE + 0.6 + r() * r() * 30))
      if (!nearPits(p.x, p.z)) out.tuft.push([p.x, p.z, 0.6 + r() * 0.9, r() * 6.28])
    }
    for (let k = 0; k < 90 * theme.flowers; k++) { // flower patches
      const s = r() * LAP_LENGTH, side = r() < 0.5 ? -1 : 1, lat = side * (EDGE + 4 + r() * 25)
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
      const p = pointAt(s, -Math.sign(c) * (EDGE + 5))
      if (nearPits(p.x, p.z)) continue
      for (let h = 0; h < 3; h++) out.tire.push([p.x, p.z, h, (stack + h) % 2])
      stack++
    }
    // flag poles along the straights
    for (let s = 20; s < LAP_LENGTH; s += 36) {
      if (Math.abs(curvatureAt(s)) > 0.006) continue
      for (const side of [-1, 1]) {
        const p = pointAt(s, side * (EDGE + 1.2))
        if (!nearPits(p.x, p.z)) out.flag.push([p.x, p.z, side, s])
      }
    }
    scatter(90 * theme.rocks, EDGE + 12, T.size * 0.4, (x, z) => out.rock.push([x, z, 0.5 + r() * (1.6 + theme.rocks), r() * 6.28]))
    // clouds
    for (let c = 0; c < 26; c++) {
      const a = (c / 26) * Math.PI * 2 + r() * 0.2, R = T.size * 0.45 + r() * 300, y = 90 + r() * 70
      const cx = T.centre.x + Math.cos(a) * R, cz = T.centre.z + Math.sin(a) * R
      for (let p = 0; p < 6; p++) out.cloud.push([cx + (r() - 0.5) * 60, y + r() * 10, cz + (r() - 0.5) * 25, 12 + r() * 14])
    }
    // tight layouts loop back on themselves: nothing may sit on another stretch of road
    for (const key of ['bush', 'tuft', 'flower', 'tire', 'flag']) {
      const min = key === 'tuft' || key === 'flower' ? KERB_OUT + 0.5 : KERB_OUT + 2
      out[key] = out[key].filter(([x, z]) => offRoad(x, z, min))
    }
    return out
  }, [blenderTrees])
}

function Instances({ geometry, material, items, place, color, castShadow = true, receiveShadow = true }) {
  const ref = useRef()
  useLayoutEffect(() => {
    if (!ref.current) return // nothing to place (e.g. no tight corners on this track)
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

const placeOnGround = (obj, [x, z, scale, rotation]) => { obj.position.set(x, heightAt(x, z) - 0.05, z); obj.scale.setScalar(scale); obj.rotation.set(0, rotation, 0) }
const makeLeafColorFn = (baseHue, hueSpread) => (color, item, index) => color.setHSL(baseHue + ((index * 0.618) % 1) * hueSpread, 0.62, 0.36 + ((index * 0.37) % 1) * 0.12)

export default function Scenery({ trees }) {
  const layout = useLayout(trees)
  const leafColors = useMemo(() => {
    const h = terrainInfo().theme.leafHue
    return {
      round: makeLeafColorFn(h, 0.08),
      bush: makeLeafColorFn(h + 0.02, 0.07),
      pine: (color, item, index) => color.setHSL(0.36 + ((index * 0.618) % 1) * 0.05, 0.55, 0.26 + ((index * 0.37) % 1) * 0.08),
    }
  }, [])
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
      <Instances geometry={GEOMETRIES.trunk} material={MATERIALS.trunk} items={layout.round} place={placeOnGround} />
      <Instances geometry={GEOMETRIES.crown} material={MATERIALS.leaves} items={layout.round} place={placeOnGround} color={leafColors.round} />
      <Instances geometry={GEOMETRIES.trunk} material={MATERIALS.trunk} items={layout.pine} place={placeOnGround} />
      <Instances geometry={GEOMETRIES.pine} material={MATERIALS.leaves} items={layout.pine} place={placeOnGround} color={leafColors.pine} />
      <Instances geometry={GEOMETRIES.bush} material={MATERIALS.leaves} items={layout.bush} place={placeOnGround} color={leafColors.bush} />
      <Instances geometry={GEOMETRIES.tuft} material={MATERIALS.grass} items={layout.tuft} place={placeOnGround} castShadow={false}
        color={(color, item, index) => color.setHSL(0.25 + ((index * 0.618) % 1) * 0.06, 0.6, 0.3 + ((index * 0.31) % 1) * 0.15)} />
      <Instances geometry={GEOMETRIES.flower} material={MATERIALS.flower} items={layout.flower} place={placeOnGround} castShadow={false}
        color={(color, item) => color.setHSL(item[4], 0.85, 0.6)} />
      <Instances geometry={GEOMETRIES.tire} material={MATERIALS.tire} items={layout.tire}
        place={(obj, [x, z, stackHeight]) => { obj.position.set(x, heightAt(x, z) + stackHeight * 0.4, z); obj.scale.setScalar(1); obj.rotation.set(0, 0, 0) }}
        color={(color, item) => color.set(item[3] ? '#f4f4f4' : '#e8231c')} />
      <Instances geometry={GEOMETRIES.rock} material={MATERIALS.rock} items={layout.rock}
        place={(obj, [x, z, scale, rotation]) => { obj.position.set(x, heightAt(x, z) + scale * 0.25, z); obj.scale.set(scale, scale * 0.65, scale * 0.9); obj.rotation.set(rotation * 0.3, rotation, 0) }} />
      <group ref={clouds}>
        <Instances geometry={GEOMETRIES.puff} material={MATERIALS.cloud} items={layout.cloud} castShadow={false} receiveShadow={false}
          place={(obj, [x, y, z, scale]) => { obj.position.set(x, y, z); obj.scale.set(scale * 1.4, scale * 0.75, scale); obj.rotation.set(0, 0, 0) }} />
      </group>
      <Instances geometry={GEOMETRIES.pole} material={MATERIALS.pole} items={layout.flag}
        place={(obj, [x, z]) => { obj.position.set(x, heightAt(x, z), z); obj.scale.setScalar(1); obj.rotation.set(0, 0, 0) }} />
      <group ref={flags}>
        {layout.flag.map(([x, z, side, trackDist], i) => {
          const baseYaw = Math.atan2(-(pointAt(trackDist + 2).z - pointAt(trackDist).z), pointAt(trackDist + 2).x - pointAt(trackDist).x) + Math.PI
          return (
            <mesh key={i} geometry={GEOMETRIES.banner} position={[x, heightAt(x, z), z]} rotation={[0, baseYaw, 0]} userData={{ base: baseYaw }} castShadow>
              <meshStandardMaterial color={flagColors[i % flagColors.length]} side={THREE.DoubleSide} roughness={0.6} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
