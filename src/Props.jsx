import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { pointAt, yawAt, curvatureAt, LAP_LENGTH, ROAD_HALF, VERGE_OUT, KERB_OUT, lapGap, offRoad } from './game/path'
import { LINE_S } from './game/constants'
import { heightAt } from './game/terrain'

// Theme-park style trackside props: inflatable arches over the road, chevron
// corner boards, striped tents, hay bales and barrels. All instanced or merged.

const PALETTE = ['#ff4b3a', '#ffc21f', '#2f7bff', '#26c26b', '#b04cff', '#ff7a1a']
const wrap = (s) => ((s % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH

/* ---------- inflatable arch: half torus with candy stripes ---------- */
function archGeometry(span, colors) {
  const geo = new THREE.TorusGeometry(span, 1.15, 14, 48, Math.PI).toNonIndexed()
  const positions = geo.attributes.position, colorBuffer = new Float32Array(positions.count * 3), tempColor = new THREE.Color()
  for (let i = 0; i < positions.count; i += 3) {
    // stripe by angle around the arch, using the triangle's centre
    const cx = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3
    const cy = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3
    const angle = Math.atan2(cy, cx)
    tempColor.set(colors[Math.floor((angle / Math.PI) * 9) % colors.length])
    for (let v = 0; v < 3; v++) colorBuffer.set([tempColor.r, tempColor.g, tempColor.b], (i + v) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colorBuffer, 3))
  geo.computeVertexNormals()
  return geo
}

/* ---------- chevron board texture ---------- */
function chevronTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 96)
  ctx.fillStyle = '#e3261c'
  for (let i = 0; i < 3; i++) { // three "<" chevrons
    const ox = 30 + i * 75
    ctx.beginPath(); ctx.moveTo(ox + 40, 10); ctx.lineTo(ox, 48); ctx.lineTo(ox + 40, 86); ctx.lineTo(ox + 62, 86); ctx.lineTo(ox + 22, 48); ctx.lineTo(ox + 62, 10); ctx.closePath(); ctx.fill()
  }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 250, 90)
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
  return texture
}

/* ---------- striped tent canopy ---------- */
function tentGeometry(colorA, colorB) {
  const geo = new THREE.ConeGeometry(3.4, 2.2, 12, 1).toNonIndexed()
  geo.translate(0, 3.6, 0)
  const positions = geo.attributes.position, colorBuffer = new Float32Array(positions.count * 3)
  const colA = new THREE.Color(colorA), colB = new THREE.Color(colorB)
  for (let i = 0; i < positions.count; i += 3) {
    const cx = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3
    const cz = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3
    const segment = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 12)
    const stripeColor = segment % 2 ? colA : colB
    for (let v = 0; v < 3; v++) colorBuffer.set([stripeColor.r, stripeColor.g, stripeColor.b], (i + v) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colorBuffer, 3))
  geo.computeVertexNormals()
  return geo
}

function Instanced({ geometry, material, items, place, color, castShadow = true }) {
  const ref = useRef()
  useLayoutEffect(() => {
    if (!ref.current) return // empty list on this track
    const dummy = new THREE.Object3D(), tempColor = new THREE.Color()
    items.forEach((item, i) => {
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1)
      place(dummy, item); dummy.updateMatrix(); ref.current.setMatrixAt(i, dummy.matrix)
      if (color) ref.current.setColorAt(i, color(tempColor, item, i))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items, place, color])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />
}

export default function Props() {
  const data = useMemo(() => {
    // ---- arches over straights (not at the start line, which has the gantry) ----
    const arches = []
    for (const frac of [0.17, 0.38, 0.6, 0.81]) {
      let s = wrap(LINE_S + frac * LAP_LENGTH)
      // slide forward to a straight bit
      for (let k = 0; k < 40 && Math.abs(curvatureAt(s)) > 0.004; k++) s = wrap(s + 8)
      // keep clear of the start gantry/grid and of the previous arch
      if (lapGap(s, LINE_S) < 70 || arches.some((a) => lapGap(a.s, s) < 90)) continue
      arches.push({ s, colors: [PALETTE[arches.length % 6], '#ffffff', PALETTE[(arches.length + 2) % 6]] })
    }

    // ---- chevron boards on the outside of sharp corners ----
    const boards = []
    for (let s = 0; s < LAP_LENGTH; s += 11) {
      const c = curvatureAt(s)
      if (Math.abs(c) < 0.009) continue
      const side = -Math.sign(c) // outside of the corner
      const p = pointAt(s, side * (VERGE_OUT + 2.5))
      if (lapGap(s, LINE_S) < 60) continue
      if (!offRoad(p.x, p.z, KERB_OUT + 1.5)) continue // another stretch of road is right there
      boards.push({ x: p.x, z: p.z, yaw: yawAt(s), left: c > 0 })
    }
    const boardsLeft = boards.filter((b) => b.left)
    const boardsRight = boards.filter((b) => !b.left)

    // ---- tents and barrels: a paddock village by the start, plus a few fan camps ----
    const tents = [], barrels = []
    const camp = (s0, side, n) => {
      for (let i = 0; i < n; i++) {
        const s = s0 + i * 11, p = pointAt(s, side * (VERGE_OUT + 10 + (i % 2) * 8))
        // tight layouts loop back on themselves: skip spots that land on another stretch of road
        if (offRoad(p.x, p.z, KERB_OUT + 5)) tents.push({ x: p.x, z: p.z, kind: i % 3 })
        for (let b = 0; b < 3; b++) {
          const q = pointAt(s + 4 + b * 1.1, side * (VERGE_OUT + 6.5))
          if (offRoad(q.x, q.z, KERB_OUT + 2)) barrels.push({ x: q.x, z: q.z, c: PALETTE[(i + b) % 6] })
        }
      }
    }
    camp(wrap(LINE_S - 140), 1, 8)
    camp(wrap(LINE_S + 0.27 * LAP_LENGTH), -1, 5)
    camp(wrap(LINE_S + 0.7 * LAP_LENGTH), 1, 5)

    // ---- hay bales on medium corners ----
    const hay = []
    for (let s = 0; s < LAP_LENGTH; s += 5) {
      const c = curvatureAt(s)
      if (Math.abs(c) < 0.005 || Math.abs(c) > 0.009) continue
      const p = pointAt(s, -Math.sign(c) * (VERGE_OUT + 1.8))
      if (offRoad(p.x, p.z, KERB_OUT + 1.5)) hay.push({ x: p.x, z: p.z, yaw: yawAt(s) })
    }
    return { arches, boards, boardsLeft, boardsRight, tents, barrels, hay }
  }, [])

  const mats = useMemo(() => {
    const chev = chevronTexture()
    const chevR = chev.clone(); chevR.repeat.x = -1; chevR.offset.x = 1; chevR.wrapS = THREE.RepeatWrapping; chevR.needsUpdate = true
    return {
      arch: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
      archFoot: new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 }),
      boardL: new THREE.MeshStandardMaterial({ map: chev, roughness: 0.6 }),
      boardR: new THREE.MeshStandardMaterial({ map: chevR, roughness: 0.6 }),
      post: new THREE.MeshStandardMaterial({ color: '#3b3b44', roughness: 0.5, metalness: 0.4 }),
      tent: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
      pole: new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.4 }),
      barrel: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
      hay: new THREE.MeshStandardMaterial({ color: '#d9b55a', roughness: 1 }),
    }
  }, [])

  const geo = useMemo(() => ({
    archFoot: new THREE.CylinderGeometry(1.5, 1.7, 0.6, 16).translate(0, 0.3, 0),
    board: new THREE.PlaneGeometry(2.6, 1).translate(0, 1.3, 0),
    boardPost: new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6).translate(0, 0.65, 0),
    tents: [['#ff4b3a', '#ffffff'], ['#2f7bff', '#ffffff'], ['#ffc21f', '#ff7a1a']].map(([a, b]) => tentGeometry(a, b)),
    tentPole: new THREE.CylinderGeometry(0.08, 0.08, 3.6, 6).translate(0, 1.8, 0),
    barrel: new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12).translate(0, 0.5, 0),
    hay: new THREE.CylinderGeometry(0.75, 0.75, 1.5, 14).rotateZ(Math.PI / 2).translate(0, 0.75, 0),
  }), [])

  const archMeshes = useMemo(() => data.arches.map((a) => {
    const p = pointAt(a.s), yaw = yawAt(a.s)
    return { geometry: archGeometry(ROAD_HALF + 3.2, a.colors), x: p.x, z: p.z, yaw }
  }), [data])

  const placeFns = useMemo(() => ({
    board: (obj, board) => { obj.position.set(board.x, heightAt(board.x, board.z), board.z); obj.rotation.y = board.yaw - Math.PI / 2 },
    post: (side) => (obj, board) => {
      const lateralOffset = side * 1.1, rotY = board.yaw - Math.PI / 2
      obj.position.set(board.x + Math.cos(rotY) * lateralOffset, heightAt(board.x, board.z), board.z - Math.sin(rotY) * lateralOffset)
    },
    tent: (obj, tent) => { obj.position.set(tent.x, heightAt(tent.x, tent.z), tent.z) },
    barrel: (obj, barrel) => { obj.position.set(barrel.x, heightAt(barrel.x, barrel.z), barrel.z) },
    hay: (obj, hay) => { obj.position.set(hay.x, heightAt(hay.x, hay.z), hay.z); obj.rotation.y = hay.yaw },
  }), [])
  const barrelColor = useMemo(() => (color, barrel) => color.set(barrel.c), [])

  return (
    <group>
      {archMeshes.map((arch, i) => (
        <group key={i} position={[arch.x, 0, arch.z]} rotation={[0, arch.yaw + Math.PI / 2, 0]}>
          <mesh geometry={arch.geometry} material={mats.arch} castShadow receiveShadow />
          <mesh geometry={geo.archFoot} material={mats.archFoot} position={[ROAD_HALF + 3.2, 0, 0]} />
          <mesh geometry={geo.archFoot} material={mats.archFoot} position={[-(ROAD_HALF + 3.2), 0, 0]} />
        </group>
      ))}
      <Instanced geometry={geo.board} material={mats.boardL} items={data.boardsLeft} place={placeFns.board} />
      <Instanced geometry={geo.board} material={mats.boardR} items={data.boardsRight} place={placeFns.board} />
      <Instanced geometry={geo.boardPost} material={mats.post} items={data.boards} place={placeFns.post(1)} castShadow={false} />
      <Instanced geometry={geo.boardPost} material={mats.post} items={data.boards} place={placeFns.post(-1)} castShadow={false} />
      {geo.tents.map((tentGeo, k) => (
        <Instanced key={k} geometry={tentGeo} material={mats.tent} items={data.tents.filter((t) => t.kind === k)} place={placeFns.tent} />
      ))}
      <Instanced geometry={geo.tentPole} material={mats.pole} items={data.tents} place={placeFns.tent} castShadow={false} />
      <Instanced geometry={geo.barrel} material={mats.barrel} items={data.barrels} place={placeFns.barrel} color={barrelColor} />
      <Instanced geometry={geo.hay} material={mats.hay} items={data.hay} place={placeFns.hay} />
    </group>
  )
}
