import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { SUN_DIR } from '../SkyDome'
import { COUNTDOWN } from '../game/constants'

const scratchVec = new THREE.Vector3()
const behindVec = new THREE.Vector3()
const cameraTargetPos = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

export function useCameraChase() {
  const camera = useThree((s) => s.camera)

  function updateCamera({ playerKart, raceState, sun, dt }) {
    behindVec.set(-Math.cos(playerKart.yaw), 0, Math.sin(playerKart.yaw))
    const cameraDistance = raceState.phase === 'countdown' ? 9 + (COUNTDOWN - raceState.t) * 1.5 : 8.5 + Math.abs(playerKart.speed) * 0.05
    const cameraHeightOffset = 3.4 + (raceState.phase === 'countdown' ? (COUNTDOWN - raceState.t) * 0.6 : 0)
    cameraTargetPos.copy(playerKart.pos).addScaledVector(behindVec, cameraDistance).addScaledVector(UP, cameraHeightOffset)
    camera.position.lerp(cameraTargetPos, 1 - Math.exp(-dt * 5))
    camera.lookAt(scratchVec.copy(playerKart.pos).addScaledVector(behindVec, -3).addScaledVector(UP, 1.3))
    const targetFov = 60 + Math.abs(playerKart.speed) * 0.35 + (playerKart.boost > 0 ? 6 : 0)
    if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 3, dt); camera.updateProjectionMatrix() }

    if (sun.current) {
      sun.current.position.copy(playerKart.pos).addScaledVector(SUN_DIR, 90)
      sun.current.target.position.copy(playerKart.pos)
      sun.current.target.updateMatrixWorld()
    }
  }

  function initCamera(playerKartState) {
    camera.position.set(playerKartState.pos.x - Math.cos(playerKartState.yaw) * 9, 4, playerKartState.pos.z + Math.sin(playerKartState.yaw) * 9)
    camera.lookAt(playerKartState.pos)
  }

  return { updateCamera, initCamera }
}
