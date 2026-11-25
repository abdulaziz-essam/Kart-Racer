import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Surface detail without UVs: the Blender meshes are procedural and have no
// UV maps, so variation is computed from world position in the shader.
// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
  varying vec3 vWorldPosN;
  float hashN(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hashN(i), hashN(i + vec2(1, 0)), u.x), mix(hashN(i + vec2(0, 1)), hashN(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`

/**
 * Adds world-space noise to a material.
 * @param {object} o  { large, fine, largeAmt, fineAmt, rough } – scales and strengths
 */
function addWorldNoise(material, o) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPosN = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 wp = vWorldPosN.xz;
        float big = fbm(wp * ${o.large.toFixed(4)});
        float speck = vnoise(wp * ${o.fine.toFixed(4)});
        diffuseColor.rgb *= 1.0 + (big - 0.5) * ${o.largeAmt.toFixed(3)} + (speck - 0.5) * ${o.fineAmt.toFixed(3)};`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (speck - 0.5) * ${o.rough.toFixed(3)}, 0.04, 1.0);`)
  }
  material.customProgramCacheKey = () => 'wn' + JSON.stringify(o)
  material.needsUpdate = true
}

const physical = (src, props) => {
  const m = new THREE.MeshPhysicalMaterial({
    color: src.color, emissive: src.emissive, emissiveIntensity: src.emissiveIntensity,
    ...props,
  })
  m.name = src.name
  return m
}

// ---------------------------------------------------------------------------
// Kart: toy-like glossy car paint, real chrome, soft rubber, warm skin
// ---------------------------------------------------------------------------
const KART_RULES = [
  [/Paint|Kart_Red|Helmet_Red|Kart_Orange|Kart_Yellow|Gantry/, { roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 }],
  [/Stripe_White|Helmet_White/, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }],
  [/Chrome/, { roughness: 0.08, metalness: 1 }],
  [/Tire/, { roughness: 0.85, metalness: 0, sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color('#333') }],
  [/Seat|Strap/, { roughness: 0.65, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color('#555') }],
  [/Skin|Blush/, { roughness: 0.55, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffd0b5') }],
  [/Suit/, { roughness: 0.6, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }],
  [/Eye|Iris|Pupil|Lens/, { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }],
  [/Light/, { roughness: 0.1, clearcoat: 1 }],
]

export function styleKart(root) {
  const cache = new Map()
  root.traverse((o) => {
    if (!o.isMesh) return
    o.castShadow = true
    o.receiveShadow = true
    const src = o.material
    if (cache.has(src)) { o.material = cache.get(src); return }
    const rule = KART_RULES.find(([re]) => re.test(src.name))
    const m = physical(src, rule ? rule[1] : { roughness: 0.4, clearcoat: 0.5 })
    m.envMapIntensity = 1.2
    cache.set(src, m)
    o.material = m
  })
}

// ---------------------------------------------------------------------------
// Track: textured asphalt/grass, glossy painted props, soft clouds
// ---------------------------------------------------------------------------
export function styleTrack(root) {
  const cache = new Map()
  root.traverse((o) => {
    if (!o.isMesh) return
    const src = o.material
    if (cache.has(src)) { o.material = cache.get(src); return }
    let m = src
    const n = src.name
    if (n === 'Asphalt') {
      m = physical(src, { color: new THREE.Color('#3a3d47'), roughness: 0.82 })
      addWorldNoise(m, { large: 0.035, fine: 3.5, largeAmt: 0.35, fineAmt: 0.25, rough: 0.3 })
    } else if (n === 'Grass' || n === 'Hill_Green') {
      m = physical(src, { roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color('#c8ff8a'), sheenRoughness: 0.6 })
      addWorldNoise(m, { large: n === 'Grass' ? 0.02 : 0.004, fine: 1.4, largeAmt: 0.55, fineAmt: 0.25, rough: 0.1 })
    } else if (n === 'Concrete') {
      m = physical(src, { roughness: 0.85 })
      addWorldNoise(m, { large: 0.08, fine: 6, largeAmt: 0.2, fineAmt: 0.12, rough: 0.2 })
    } else if (n === 'Leaves') {
      m = physical(src, { roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#d6ff9c'), sheenRoughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.4 })
    } else if (n === 'Cloud') {
      m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#dfeeff', emissiveIntensity: 0.55, roughness: 1, fog: false })
      m.name = n
    } else if (/Kerb|Barrier|Steel|Seats|Balloon|Gantry|Line_White/.test(n)) {
      m = physical(src, { roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 })
    } else if (n === 'Glass') {
      m = physical(src, { roughness: 0.05, metalness: 0.2, clearcoat: 1 })
    }
    cache.set(src, m)
    o.material = m
  })
}
