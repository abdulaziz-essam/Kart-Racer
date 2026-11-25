import * as THREE from 'three'
import { useMemo } from 'react'

// Same direction as the sun light in Kart.jsx (offset 40, 70, 25).
export const SUN_DIR = new THREE.Vector3(40, 70, 25).normalize()

// Soft sky: warm hazy horizon, rich blue overhead, glow around the sun.
export default function SkyDome() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#2463d6') },
      mid: { value: new THREE.Color('#6fb2f2') },
      horizon: { value: new THREE.Color('#f4ead8') },
      sunColor: { value: new THREE.Color('#fff3d1') },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, horizon, sunColor, sunDir; varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, top, smoothstep(0.18, 0.75, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += sunColor * (pow(s, 8.0) * 0.35 + pow(s, 400.0) * 2.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [])
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[2500, 48, 24]} />
    </mesh>
  )
}
