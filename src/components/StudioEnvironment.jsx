import * as THREE from 'three'
import { Environment, Lightformer } from '@react-three/drei'
import { SUN_DIR } from '../SkyDome'

// Reflections for glossy paint and chrome: a soft sky dome, a warm sun panel,
// green bounce light from the grass and a few studio strips for car highlights.
const StudioEnvironment = () => {
  const sun = SUN_DIR.clone().multiplyScalar(60)
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.45}>
      <mesh scale={150}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#8fbbe8" side={THREE.BackSide} />
      </mesh>
      <Lightformer form="circle" intensity={2.5} color="#fff1d6" position={sun.toArray()} scale={18} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#7da84a" position={[0, -40, 0]} rotation-x={Math.PI / 2} scale={[300, 300, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 12, -60]} scale={[120, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.7} color="#e8f3ff" position={[-60, 10, 20]} scale={[90, 5, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.6} color="#ffe6c4" position={[60, 8, 30]} scale={[90, 5, 1]} target={[0, 0, 0]} />
    </Environment>
  )
}

export default StudioEnvironment
