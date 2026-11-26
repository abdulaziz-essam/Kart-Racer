import * as THREE from 'three'
import { useMemo } from 'react'
import { buildTerrainGeometry, terrainInfo, WATER_LEVEL } from './game/terrain'
import { addWorldNoise } from './materials'

/** Rolling, vertex-coloured landscape around the circuit (+ a lake on Lakeside). */
export default function Terrain() {
  const { geometry, material, lake } = useMemo(() => {
    const geometry = buildTerrainGeometry()
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
    addWorldNoise(material, { large: 0.025, fine: 1.2, largeAmt: 0.35, fineAmt: 0.18, rough: 0.05 })
    return { geometry, material, lake: terrainInfo().lake }
  }, [])
  return (
    <>
      <mesh geometry={geometry} material={material} receiveShadow />
      {lake && (
        <mesh position={[lake.x, WATER_LEVEL, lake.z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[lake.r * 1.25, 64]} />
          <meshPhysicalMaterial color="#2f8fd6" roughness={0.12} metalness={0} transmission={0} clearcoat={0.6} clearcoatRoughness={0.1} envMapIntensity={0.9} />
        </mesh>
      )}
    </>
  )
}
