import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pointAt, yawAt, ROAD_HALF } from './game/path'
import { chooseStand, STAND_ROW_DEPTH, STAND_ROW_RISE } from './game/startArea'
import TrackSurface from './TrackSurface'
import Terrain from './Terrain'
import Props from './Props'

// Everything about a circuit is generated from its racing line (a few KB of
// JSON per track), so nothing heavy is downloaded per race: road and kerbs
// (TrackSurface), landscape (Terrain), trackside props (Props) and the start
// area built here (gantry with start lights, grandstand, balloons, bunting).

const POST_LAT = ROAD_HALF + 3.5
const PALETTE = ['#ff4b3a', '#ffc21f', '#2f7bff', '#26c26b', '#b04cff', '#ff7a1a']

/** Ground-plane box collider for a box centred at (x, z), its long side along `yaw`. */
const boxAt = (x, z, yaw, hx, hz) => ({ x, z, cos: Math.cos(yaw), sin: -Math.sin(yaw), hx, hz, reach: Math.hypot(hx, hz) + 3 })

function checkerTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 64
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(i * 16, j * 16, 16, 16) }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildStartArea() {
  const group = new THREE.Group()
  const p = pointAt(0), yaw = yawAt(0)
  const boxes = []

  // ---- gantry over the start line ----
  const gantry = new THREE.Group()
  gantry.position.set(p.x, 0, p.z); gantry.rotation.y = yaw
  const postMat = new THREE.MeshStandardMaterial({ color: '#ffc21f', roughness: 0.5 })
  const beamMat = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.5 })
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), postMat)
    post.position.set(0, 4, side * POST_LAT); post.castShadow = true
    gantry.add(post)
    const w = new THREE.Vector3(0, 0, side * POST_LAT).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    boxes.push(boxAt(p.x + w.x, p.z + w.z, yaw, 0.5, 0.5))
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, POST_LAT * 2 + 1.2), beamMat)
  beam.position.y = 7.8; beam.castShadow = true
  gantry.add(beam)
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(POST_LAT * 2 - 1, 1.1), new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.6, side: THREE.DoubleSide }))
  banner.position.set(-0.65, 6.6, 0); banner.rotation.y = -Math.PI / 2
  gantry.add(banner)
  const bulbs = []
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), new THREE.MeshStandardMaterial({ color: '#2a0505', emissive: '#ff1a0a', emissiveIntensity: 0, roughness: 0.3 }))
    b.position.set(-0.7, 7.8, (i - 2) * 1.5)
    gantry.add(b); bulbs.push(b)
  }
  // balloon bunches on the posts
  const balloons = []
  for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshStandardMaterial({ color: PALETTE[(k + (side > 0 ? 3 : 0)) % 6], roughness: 0.35 }))
    m.scale.y = 1.2
    m.position.set((Math.random() - 0.5) * 2.4, 9.5 + Math.random() * 2.2, side * POST_LAT + (Math.random() - 0.5) * 2.4)
    m.castShadow = true
    gantry.add(m); balloons.push({ o: m, y: m.position.y, p: Math.random() * 6 })
  }
  group.add(gantry)

  // ---- grandstand beside the start straight, with a crowd ----
  // chooseStand() picks the side and size whose footprint is clear of every
  // stretch of road (tight layouts can loop back right behind the start).
  const S = chooseStand()
  if (S) {
    const RD = STAND_ROW_DEPTH, RR = STAND_ROW_RISE
    const stand = new THREE.Group()
    const sp = pointAt(0, S.side * (Math.abs(S.lat) + RD / 2))
    // local +z points away from the road: right of travel at `yaw`, left at `yaw + PI`
    stand.position.set(sp.x, 0, sp.z); stand.rotation.y = S.side < 0 ? yaw : yaw + Math.PI
    const concrete = new THREE.MeshStandardMaterial({ color: '#e9dfc8', roughness: 0.85 })
    const seatMats = ['#e3261c', '#2f7bff'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }))
    for (let r = 0; r < S.rows; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(S.length, RR * (r + 1), RD), r % 2 ? seatMats[r % 4 === 1 ? 0 : 1] : concrete)
      step.position.set(0, (RR * (r + 1)) / 2, r * RD)
      step.castShadow = step.receiveShadow = true
      stand.add(step)
    }
    const depth = S.rows * RD
    const back = new THREE.Mesh(new THREE.BoxGeometry(S.length, S.rows * RR + 4, 0.6), concrete)
    back.position.set(0, (S.rows * RR + 4) / 2, depth - RD / 2 + 0.3); back.castShadow = true
    stand.add(back)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(S.length + 4, 0.4, depth + 4), new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.5 }))
    roof.position.set(0, S.rows * RR + 5, depth / 2 - 2); roof.rotation.x = -0.06; roof.castShadow = true
    stand.add(roof)
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, S.rows * RR + 5, 8), concrete)
      col.position.set(sx * (S.length / 2), (S.rows * RR + 5) / 2, -1.5)
      stand.add(col)
    }
    // crowd: one instanced mesh of little round fans in random shirt colours, only on the seats
    const perRow = Math.round(S.length / 1.45)
    const fans = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.32, 0.5, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), S.rows * perRow)
    const dummy = new THREE.Object3D(), tempColor = new THREE.Color()
    let fanCount = 0
    for (let r = 0; r < S.rows; r++) for (let k = 0; k < perRow; k++) {
      if (Math.random() < 0.18) continue
      dummy.position.set(-S.length / 2 + 1 + k * ((S.length - 2) / (perRow - 1)), RR * (r + 1) + 0.6, r * RD + (Math.random() - 0.5) * 0.6)
      dummy.updateMatrix(); fans.setMatrixAt(fanCount, dummy.matrix)
      fans.setColorAt(fanCount, tempColor.setHSL(Math.random(), 0.65, 0.55)); fanCount++
    }
    fans.count = fanCount
    stand.add(fans)
    group.add(stand)
    // collider: the whole stand footprint
    const mid = pointAt(0, S.centreLat)
    boxes.push(boxAt(mid.x, mid.z, yaw, S.length / 2 + 0.5, depth / 2 + 0.5))
  }

  // ---- bunting between the gantry and the stand ----
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.35, -0.4), new THREE.Vector3(0, 0.35, 0.4), new THREE.Vector3(0, -0.5, 0)])
  flagGeo.computeVertexNormals()
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16
    const f = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: PALETTE[i % 6], side: THREE.DoubleSide }))
    f.position.set(0, 7 - Math.sin(t * Math.PI) * 0.8, -POST_LAT + t * POST_LAT * 2)
    gantry.add(f)
  }
  return { group, boxes, bulbs, balloons }
}

export default function Track({ onReady }) {
  const balloons = useRef([])
  const startArea = useMemo(() => {
    const area = buildStartArea()
    balloons.current = area.balloons
    return { group: area.group, colliders: { boxes: area.boxes }, trees: [], bulbs: area.bulbs }
  }, [])

  useEffect(() => { onReady?.(startArea) }, [startArea, onReady])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (const b of balloons.current) {
      b.o.position.y = b.y + Math.sin(t * 1.6 + b.p) * 0.35
      b.o.rotation.z = Math.sin(t * 1.1 + b.p) * 0.08
    }
  })

  return (
    <>
      <primitive object={startArea.group} />
      <TrackSurface />
      <Terrain />
      <Props />
    </>
  )
}
