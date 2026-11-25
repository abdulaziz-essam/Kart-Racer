import * as THREE from 'three'
import { useMemo } from 'react'
import { buildTerrainGeometry } from './game/terrain'
import { addWorldNoise } from './materials'

/** Rolling, vertex-coloured landscape around the circuit (one draw call). */
export default function Terrain() {
  const { geometry, material } = useMemo(() => {
    const geometry = buildTerrainGeometry()
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
    addWorldNoise(material, { large: 0.025, fine: 1.2, largeAmt: 0.35, fineAmt: 0.18, rough: 0.05 })
    return { geometry, material }
  }, [])
  return <mesh geometry={geometry} material={material} receiveShadow />
}
