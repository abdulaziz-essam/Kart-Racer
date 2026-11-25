import * as THREE from 'three'

// Opponent cars from Kenney's Toy Car Kit (CC0, www.kenney.nl).
// The models are ~0.9 m long, Y-up, front towards -Z, with four wheel nodes
// (wheel-fl, wheel-fr, wheel-bl, wheel-br) whose axle is the local X axis.

export const KENNEY_SCALE = 3.4 // ~3 m long, similar to the player's kart
const TO_KART = new THREE.Euler(0, -Math.PI / 2, 0) // model front (-Z) -> kart front (+X)

/**
 * Glossy material using the white "variation B" palette; white texels are tinted
 * with the team colour so dark trim, tyres and windows keep their colours.
 */
function teamMaterial(map, tint) {
  const m = new THREE.MeshPhysicalMaterial({ map, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.02 })
  const color = new THREE.Color(tint)
  m.onBeforeCompile = (shader) => {
    shader.uniforms.tint = { value: color }
    shader.fragmentShader = 'uniform vec3 tint;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float whiteness = smoothstep(0.62, 0.9, min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b));
      diffuseColor.rgb = mix(diffuseColor.rgb, tint, whiteness);`)
  }
  m.customProgramCacheKey = () => 'kenney-tint'
  return m
}

/** Build one opponent from a loaded Kenney glTF scene. Same shape as makeKart(). */
export function makeKenneyKart(gltfScene, map, tint) {
  const src = gltfScene.clone(true)
  const material = teamMaterial(map, tint)
  src.traverse((o) => { if (o.isMesh) { o.material = material; o.castShadow = true; o.receiveShadow = true } })

  const root = new THREE.Group()
  const body = new THREE.Group() // kart space: Race.jsx rolls/pitches/bobs this
  const inner = new THREE.Group()
  inner.rotation.copy(TO_KART)
  inner.scale.setScalar(KENNEY_SCALE)
  inner.add(src)
  body.add(inner)
  root.add(body)

  const rot = new THREE.Matrix4().makeRotationFromEuler(TO_KART)
  const wheels = []
  for (const name of ['wheel-fl', 'wheel-fr', 'wheel-bl', 'wheel-br']) {
    const w = src.getObjectByName(name)
    if (!w) continue
    const pivot = new THREE.Group()
    pivot.rotation.order = 'YZX' // steer (Y) outside, spin (Z) inside
    pivot.position.copy(w.position).multiplyScalar(KENNEY_SCALE).applyMatrix4(rot)
    w.parent.remove(w)
    w.position.set(0, 0, 0)
    w.rotation.copy(TO_KART)
    w.scale.setScalar(KENNEY_SCALE)
    pivot.add(w)
    root.add(pivot)
    w.geometry.computeBoundingBox()
    const r = (w.geometry.boundingBox.max.y - w.geometry.boundingBox.min.y) / 2 * KENNEY_SCALE
    wheels.push({ pivot, front: name.includes('-f'), r })
  }

  const driver = new THREE.Object3D() // these cars have no separate driver to lean
  body.add(driver)
  return { root, body, driver, wheels }
}
