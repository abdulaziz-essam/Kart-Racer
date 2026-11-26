import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { pointAt, yawAt, curvatureAt, LAP_LENGTH, ROAD_HALF, VERGE_OUT, lapGap } from './game/path'
import { LINE_S } from './game/constants'
import { heightAt } from './game/terrain'

// Theme-park style trackside props: inflatable arches over the road, chevron
// corner boards, striped tents, hay bales and barrels. All instanced or merged.

const PALETTE = ['#ff4b3a', '#ffc21f', '#2f7bff', '#26c26b', '#b04cff', '#ff7a1a']
const wrap = (s) => ((s % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH

/* ---------- inflatable arch: half torus with candy stripes ---------- */
function archGeometry(span, colors) {
  const g = new THREE.TorusGeometry(span, 1.15, 14, 48, Math.PI).toNonIndexed()
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color()
  for (let i = 0; i < pos.count; i += 3) {
    // stripe by angle around the arch, using the triangle's centre
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
    const a = Math.atan2(y, x)
    c.set(colors[Math.floor((a / Math.PI) * 9) % colors.length])
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/* ---------- chevron board texture ---------- */
function chevronTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96
  const x = cv.getContext('2d')
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 96)
  x.fillStyle = '#e3261c'
  for (let i = 0; i < 3; i++) { // three "<" chevrons
    const ox = 30 + i * 75
    x.beginPath(); x.moveTo(ox + 40, 10); x.lineTo(ox, 48); x.lineTo(ox + 40, 86); x.lineTo(ox + 62, 86); x.lineTo(ox + 22, 48); x.lineTo(ox + 62, 10); x.closePath(); x.fill()
  }
  x.strokeStyle = '#1a1a1a'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 90)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/* ---------- striped tent canopy ---------- */
function tentGeometry(colorA, colorB) {
  const g = new THREE.ConeGeometry(3.4, 2.2, 12, 1).toNonIndexed()
  g.translate(0, 3.6, 0)
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3)
  const a = new THREE.Color(colorA), b = new THREE.Color(colorB)
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    const seg = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12)
    const c = seg % 2 ? a : b
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function Instanced({ geometry, material, items, place, color, castShadow = true }) {
  const ref = useRef()
  useLayoutEffect(() => {
    if (!ref.current) return // empty list on this track
    const o = new THREE.Object3D(), c = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1)
      place(o, it); o.updateMatrix(); ref.current.setMatrixAt(i, o.matrix)
      if (color) ref.current.setColorAt(i, color(c, it, i))
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
      boards.push({ x: p.x, z: p.z, yaw: yawAt(s), left: c > 0 })
    }

    // ---- tents and barrels: a paddock village by the start, plus a few fan camps ----
    const tents = [], barrels = []
    const camp = (s0, side, n) => {
      for (let i = 0; i < n; i++) {
        const s = s0 + i * 11, p = pointAt(s, side * (VERGE_OUT + 10 + (i % 2) * 8))
        tents.push({ x: p.x, z: p.z, kind: i % 3 })
        for (let b = 0; b < 3; b++) {
          const q = pointAt(s + 4 + b * 1.1, side * (VERGE_OUT + 6.5))
          barrels.push({ x: q.x, z: q.z, c: PALETTE[(i + b) % 6] })
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
      hay.push({ x: p.x, z: p.z, yaw: yawAt(s) })
    }
    return { arches, boards, tents, barrels, hay }
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

  const place = useMemo(() => ({
    board: (o, b) => { o.position.set(b.x, heightAt(b.x, b.z), b.z); o.rotation.y = b.yaw - Math.PI / 2 },
    post: (side) => (o, b) => {
      const off = side * 1.1, ry = b.yaw - Math.PI / 2
      o.position.set(b.x + Math.cos(ry) * off, heightAt(b.x, b.z), b.z - Math.sin(ry) * off)
    },
    tent: (o, t) => { o.position.set(t.x, heightAt(t.x, t.z), t.z) },
    barrel: (o, b) => { o.position.set(b.x, heightAt(b.x, b.z), b.z) },
    hay: (o, h) => { o.position.set(h.x, heightAt(h.x, h.z), h.z); o.rotation.y = h.yaw },
  }), [])
  const barrelColor = useMemo(() => (c, b) => c.set(b.c), [])

  return (
    <group>
      {archMeshes.map((a, i) => (
        <group key={i} position={[a.x, 0, a.z]} rotation={[0, a.yaw + Math.PI / 2, 0]}>
          <mesh geometry={a.geometry} material={mats.arch} castShadow receiveShadow />
          <mesh geometry={geo.archFoot} material={mats.archFoot} position={[ROAD_HALF + 3.2, 0, 0]} />
          <mesh geometry={geo.archFoot} material={mats.archFoot} position={[-(ROAD_HALF + 3.2), 0, 0]} />
        </group>
      ))}
      <Instanced geometry={geo.board} material={mats.boardL} items={data.boards.filter((b) => b.left)} place={place.board} />
      <Instanced geometry={geo.board} material={mats.boardR} items={data.boards.filter((b) => !b.left)} place={place.board} />
      <Instanced geometry={geo.boardPost} material={mats.post} items={data.boards} place={place.post(1)} castShadow={false} />
      <Instanced geometry={geo.boardPost} material={mats.post} items={data.boards} place={place.post(-1)} castShadow={false} />
      {geo.tents.map((g, k) => (
        <Instanced key={k} geometry={g} material={mats.tent} items={data.tents.filter((t) => t.kind === k)} place={place.tent} />
      ))}
      <Instanced geometry={geo.tentPole} material={mats.pole} items={data.tents} place={place.tent} castShadow={false} />
      <Instanced geometry={geo.barrel} material={mats.barrel} items={data.barrels} place={place.barrel} color={barrelColor} />
      <Instanced geometry={geo.hay} material={mats.hay} items={data.hay} place={place.hay} />
    </group>
  )
}
