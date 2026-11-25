import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { styleKart } from '../materials'

// The Blender kart is ~130 small meshes. Drawing 6 of those would be ~800 draw
// calls, so every static part is merged per material (body and driver
// separately), and only the 12 wheel parts stay separate so they can spin/steer.

const WHEEL_RE = /^Kart_(Tire|Rim|Hub)_(FL|FR|RL|RR)$/

function clean(geometry, matrix) {
  let g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
  g.applyMatrix4(matrix)
  return g
}

function mergeBuckets(buckets) {
  const meshes = []
  for (const [material, geos] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(geos), material)
    m.castShadow = true
    m.receiveShadow = true
    meshes.push(m)
  }
  return meshes
}

/** Turn the loaded glTF kart into a lightweight prototype (run once). */
export function prepareKart(gltfScene) {
  styleKart(gltfScene)
  gltfScene.updateMatrixWorld(true)
  const driverNode = gltfScene.getObjectByName('Kart_Driver')
  const driverPivot = new THREE.Vector3().setFromMatrixPosition(driverNode.matrixWorld)
  const driverInv = new THREE.Matrix4().makeTranslation(-driverPivot.x, -driverPivot.y, -driverPivot.z)

  const isDriver = (o) => { for (let p = o; p; p = p.parent) if (p === driverNode) return true; return false }
  const body = new Map(), driver = new Map(), wheels = {}
  const push = (map, mat, g) => { if (!map.has(mat)) map.set(mat, []); map.get(mat).push(g) }

  gltfScene.traverse((o) => {
    if (!o.isMesh) return
    const name = o.parent && o.parent.type === 'Group' && o.name.startsWith(o.parent.name) && WHEEL_RE.test(o.parent.name) ? o.parent.name : o.name
    const w = name.match(WHEEL_RE)
    if (w) {
      const key = w[2]
      wheels[key] ??= { key, front: key[0] === 'F', parts: [] }
      wheels[key].parts.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone(), kind: w[1] })
      return
    }
    if (isDriver(o)) push(driver, o.material, clean(o.geometry, new THREE.Matrix4().multiplyMatrices(driverInv, o.matrixWorld)))
    else push(body, o.material, clean(o.geometry, o.matrixWorld))
  })

  // wheel pivots at the tyre centre
  for (const w of Object.values(wheels)) {
    const tire = w.parts.find((p) => p.kind === 'Tire') || w.parts[0]
    w.center = new THREE.Vector3().setFromMatrixPosition(tire.matrix)
    tire.geometry.computeBoundingBox()
    w.r = (tire.geometry.boundingBox.max.y - tire.geometry.boundingBox.min.y) / 2
  }

  return { body: mergeBuckets(body), driver: mergeBuckets(driver), driverPivot, wheels: Object.values(wheels) }
}

const PAINT_RE = /Paint/
const HELMET_RE = /Helmet_Red/

/** A new kart instance (shares geometry with the prototype). */
export function makeKart(proto, paint, helmet) {
  const recolor = (m, re, c) => {
    if (!c || !re.test(m.name)) return m
    const n = m.clone(); n.color = new THREE.Color(c); return n
  }
  const root = new THREE.Group()
  const bodyGroup = new THREE.Group()
  root.add(bodyGroup)
  for (const m of proto.body) {
    const mesh = new THREE.Mesh(m.geometry, recolor(m.material, PAINT_RE, paint))
    mesh.castShadow = mesh.receiveShadow = true
    bodyGroup.add(mesh)
  }
  const driver = new THREE.Group()
  driver.position.copy(proto.driverPivot)
  for (const m of proto.driver) {
    const mesh = new THREE.Mesh(m.geometry, recolor(m.material, HELMET_RE, helmet))
    mesh.castShadow = mesh.receiveShadow = true
    driver.add(mesh)
  }
  bodyGroup.add(driver)

  const wheels = proto.wheels.map((w) => {
    const pivot = new THREE.Group()
    pivot.rotation.order = 'YZX' // steer (Y) outside, spin (Z) inside
    pivot.position.copy(w.center)
    for (const p of w.parts) {
      const mesh = new THREE.Mesh(p.geometry, p.material)
      p.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
      mesh.position.sub(w.center)
      mesh.castShadow = true
      pivot.add(mesh)
    }
    root.add(pivot)
    return { pivot, front: w.front, r: w.r }
  })

  return { root, body: bodyGroup, driver, wheels }
}
