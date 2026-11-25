import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { styleTrack } from './materials'
import { WORLD_SCALE } from './game/path'
import TrackSurface from './TrackSurface'
import Terrain from './Terrain'
import Props from './Props'

// Blender object name of a mesh. Multi-material objects load as a Group whose
// child meshes are the primitives, so use the group's name for those
// (but never the glTF root group, which has no parent yet).
const baseName = (o) => {
  const p = o.parent
  if (p && p.type === 'Group' && p.parent && o.name.startsWith(p.name)) return p.name
  return o.name
}
// Drawn procedurally in TrackSurface.jsx (wider road, new kerbs), or removed
// (barriers, pit wall, and the pit building that walled off the start straight)
const REMOVED = /^(Road|EdgeLine|Kerb|Runoff|StartLine|Barrier|Pit_|Ground|Hill_)/
// Replaced by lighter instanced versions in Scenery.jsx
const REPLACED = /^(Tree_|Cloud_)/
// Kept as separate meshes because they animate
const DYNAMIC = /^(Balloon|StartLight)/
// Solid things karts bump into
const SOLID = /^(Gantry_Post|Stand_)/
const NO_SHADOW = /^(Ground|Hill)/

const SCALE = new THREE.Matrix4().makeScale(WORLD_SCALE, WORLD_SCALE, WORLD_SCALE)

function cleanGeometry(geometry, matrix) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
  return g.applyMatrix4(matrix)
}

/** Oriented ground-plane box from a mesh's local bounding box and world matrix. */
function boxCollider(geometry, world) {
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(world)
  const size = bb.getSize(new THREE.Vector3())
  const e = world.elements
  const ax = new THREE.Vector2(e[0], e[2]), az = new THREE.Vector2(e[8], e[10])
  const hx = (size.x / 2) * ax.length(), hz = (size.z / 2) * az.length()
  ax.normalize()
  return { x: c.x, z: c.z, cos: ax.x, sin: ax.y, hx, hz, reach: Math.hypot(hx, hz) + 3 }
}

/**
 * Loads the Blender track, scales it up, restyles it, and merges every static
 * mesh by material (~250 objects -> ~15 draw calls).
 */
export default function Track({ onReady }) {
  const { scene } = useGLTF('/models/track.glb')
  const balloons = useRef([])

  const built = useMemo(() => {
    styleTrack(scene)
    scene.updateMatrixWorld(true)
    const boxes = [], trees = []
    const buckets = new Map() // material -> { geos, shadow }
    const dynamic = []
    const world = new THREE.Matrix4()

    scene.traverse((o) => {
      if (!o.isMesh) return
      const n = baseName(o)
      if (REMOVED.test(n)) return
      world.multiplyMatrices(SCALE, o.matrixWorld)
      if (REPLACED.test(n)) {
        if (n.startsWith('Tree_')) {
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
          world.decompose(p, q, s)
          trees.push({ x: p.x, z: p.z, s: s.x })
        }
        return
      }
      if (SOLID.test(n)) boxes.push(boxCollider(o.geometry, world))
      if (DYNAMIC.test(n)) { dynamic.push({ o, n, world: world.clone() }); return }
      if (!buckets.has(o.material)) buckets.set(o.material, { geos: [], shadow: !NO_SHADOW.test(n) })
      buckets.get(o.material).geos.push(cleanGeometry(o.geometry, world))
    })

    const group = new THREE.Group()
    for (const [material, { geos, shadow }] of buckets) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), material)
      mesh.receiveShadow = true
      mesh.castShadow = shadow
      group.add(mesh)
    }
    for (const { o, n, world: w } of dynamic) {
      const m = new THREE.Mesh(o.geometry, o.material)
      w.decompose(m.position, m.quaternion, m.scale)
      m.castShadow = true
      m.name = n
      group.add(m)
      if (n.startsWith('Balloon')) balloons.current.push({ o: m, y: m.position.y, p: Math.random() * 6 })
    }
    // start lights: own material per bulb so the countdown can switch them
    const bulbs = group.children.filter((m) => m.name.startsWith('StartLight')).sort((a, b) => a.name.localeCompare(b.name))
    for (const b of bulbs) b.material = new THREE.MeshStandardMaterial({ color: '#2a0505', emissive: '#ff1a0a', emissiveIntensity: 0, roughness: 0.3 })

    return { group, colliders: { boxes }, trees, bulbs }
  }, [scene])

  useEffect(() => { onReady?.(built) }, [built, onReady])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (const b of balloons.current) {
      b.o.position.y = b.y + Math.sin(t * 1.6 + b.p) * 0.35
      b.o.rotation.z = Math.sin(t * 1.1 + b.p) * 0.08
    }
  })

  return (
    <>
      <primitive object={built.group} />
      <TrackSurface />
      <Terrain />
      <Props />
    </>
  )
}

useGLTF.preload('/models/track.glb')
