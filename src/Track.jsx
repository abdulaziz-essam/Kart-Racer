import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { styleTrack } from './materials'

// Blender object name of a mesh. Multi-material objects load as a Group whose
// child meshes are the primitives, so use the group's name for those
// (but never the glTF root group, which has no parent yet).
const baseName = (o) => {
  const p = o.parent
  if (p && p.type === 'Group' && p.parent && o.name.startsWith(p.name)) return p.name
  return o.name
}
const FLAT = /^(Ground|Road|EdgeLine|Kerb|Runoff|StartLine)/
// Replaced by lighter instanced versions in Scenery.jsx
const REPLACED = /^(Tree_|Cloud_)/
// Kept as separate meshes because they animate
const DYNAMIC = /^(Balloon|StartLight)/

function cleanGeometry(geometry, matrix) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
  return g.applyMatrix4(matrix)
}

/**
 * Loads the Blender track, restyles it, and merges every static mesh by
 * material (~250 objects -> ~20 draw calls).
 */
export default function Track({ onReady }) {
  const { scene } = useGLTF('/models/track.glb')
  const balloons = useRef([])

  const built = useMemo(() => {
    styleTrack(scene)
    scene.updateMatrixWorld(true)
    const road = [], runoff = [], posts = [], trees = [], lights = []
    const buckets = new Map()   // material -> { geos, flat }
    const dynamic = []

    scene.traverse((o) => {
      if (!o.isMesh) return
      const n = baseName(o)
      if (REPLACED.test(n)) {
        if (n.startsWith('Tree_')) {
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
          o.matrixWorld.decompose(p, q, s)
          trees.push({ x: p.x, z: p.z, s: s.x })
        }
        return
      }
      // Raycast targets for the player's surface check (kept out of the scene)
      if (/^(Road|Kerb|StartLine|EdgeLine)/.test(n) || n.startsWith('Runoff')) {
        const m = new THREE.Mesh(o.geometry, o.material)
        m.matrixAutoUpdate = false
        m.matrixWorld.copy(o.matrixWorld)
        ;(n.startsWith('Runoff') ? runoff : road).push(m)
      }
      if (/^(Gantry_Post|Stand_Column)/.test(n)) {
        const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox
        posts.push({ x: p.x, z: p.z, r: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 })
      }
      if (DYNAMIC.test(n)) {
        dynamic.push(o)
        if (n.startsWith('StartLight')) lights.push(o)
        return
      }
      if (!buckets.has(o.material)) buckets.set(o.material, { geos: [], flat: FLAT.test(n) })
      buckets.get(o.material).geos.push(cleanGeometry(o.geometry, o.matrixWorld))
    })

    const group = new THREE.Group()
    for (const [material, { geos, flat }] of buckets) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), material)
      mesh.receiveShadow = true
      mesh.castShadow = !flat
      group.add(mesh)
    }
    for (const o of dynamic) {
      const m = new THREE.Mesh(o.geometry, o.material)
      o.matrixWorld.decompose(m.position, m.quaternion, m.scale)
      m.castShadow = true
      m.name = baseName(o)
      group.add(m)
      if (m.name.startsWith('Balloon')) balloons.current.push({ o: m, y: m.position.y, p: Math.random() * 6 })
    }
    // start lights: own material per bulb so the countdown can switch them
    const bulbs = group.children.filter((m) => m.name.startsWith('StartLight')).sort((a, b) => a.name.localeCompare(b.name))
    for (const b of bulbs) b.material = new THREE.MeshStandardMaterial({ color: '#2a0505', emissive: '#ff1a0a', emissiveIntensity: 0, roughness: 0.3 })

    return { group, colliders: { road, runoff, posts }, trees, bulbs }
  }, [scene])

  useEffect(() => { onReady?.(built) }, [built, onReady])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (const b of balloons.current) {
      b.o.position.y = b.y + Math.sin(t * 1.6 + b.p) * 0.35
      b.o.rotation.z = Math.sin(t * 1.1 + b.p) * 0.08
    }
  })

  return <primitive object={built.group} />
}

useGLTF.preload('/models/track.glb')
