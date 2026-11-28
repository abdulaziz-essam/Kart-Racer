import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Paper-cutout look, part 1: thick black outlines around cars, props, trees and
// buildings ("inverted hull": a slightly inflated back-face copy drawn in ink).
// Works for normal and instanced meshes; big flat things (road, terrain) and tiny
// details (grass, flowers) are skipped. New objects are picked up automatically.

const outlineMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  fog: false,
  uniforms: { ink: { value: new THREE.Color('#1d1b24') }, thickness: { value: 0.0055 } },
  vertexShader: /* glsl */ `
    uniform float thickness;
    void main() {
      #ifdef USE_INSTANCING
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
      #else
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
      #endif
      // roughly constant width on screen, capped so far objects don't turn into blobs
      mv.xyz += n * thickness * clamp(-mv.z, 2.0, 70.0);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 ink;
    void main() { gl_FragColor = vec4(ink, 1.0); }`,
})

function eligible(o) {
  if (!o.isMesh || o.userData.isOutline || o.userData.outlined || o.userData.noOutline) return false
  const m = o.material
  if (!m || Array.isArray(m) || m.transparent || m.side === THREE.BackSide || m.isShaderMaterial) return false
  if (!o.geometry?.attributes?.normal) return false
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
  // flat things (signs, banners, flags) would just get a shifted black copy: skip
  const size = o.geometry.boundingBox.getSize(new THREE.Vector3())
  const minSide = Math.min(size.x, size.y, size.z), maxSide = Math.max(size.x, size.y, size.z)
  if (minSide < maxSide * 0.03) return false
  o.updateWorldMatrix(true, false)
  const r = o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis()
  return r > 0.45 && r < 40 // no grass tufts / flowers, no road ribbons / terrain
}

function outline(o) {
  o.userData.outlined = true
  let hull
  if (o.isInstancedMesh) {
    hull = new THREE.InstancedMesh(o.geometry, outlineMaterial, o.count)
    hull.instanceMatrix = o.instanceMatrix // shares the same transforms
    hull.count = o.count
    hull.frustumCulled = false
  } else {
    hull = new THREE.Mesh(o.geometry, outlineMaterial)
  }
  hull.userData.isOutline = true
  hull.raycast = () => {}
  hull.castShadow = hull.receiveShadow = false
  o.add(hull)
}

export default function PaperOutlines({ enabled = true }) {
  const scene = useThree((s) => s.scene)
  const tick = useRef(0)
  useFrame((_, dt) => {
    outlineMaterial.visible = enabled
    if (!enabled) return
    tick.current += dt
    if (tick.current < 0.5) return // look for newly added objects twice a second
    tick.current = 0
    const found = []
    scene.traverse((o) => { if (eligible(o)) found.push(o) })
    found.forEach(outline)
  })
  return null
}
