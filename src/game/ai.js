import * as THREE from 'three'
import { pointAt, curvatureAt, ROAD_HALF } from './path'

const target = new THREE.Vector3()

/**
 * AI driver: aims at a point ahead on the racing line (shifted to its own lane),
 * brakes for tight corners, and gets a gentle rubber band so the race stays close.
 * Returns an input object for stepKart.
 */
export function aiInput(st, driver, playerRaceDist, t) {
  const speed = Math.max(st.speed, 0)
  const ahead = 7 + speed * 0.55
  const s = st.loc.dist + ahead

  // weave a little inside the lane so the field does not drive in single file
  const lane = THREE.MathUtils.clamp(driver.lane + Math.sin(t * 0.25 + driver.phase) * 1.2, -ROAD_HALF + 1.5, ROAD_HALF - 1.5)
  // cut towards the inside of corners
  const curve = curvatureAt(s)
  pointAt(s, lane + THREE.MathUtils.clamp(curve * 120, -2.5, 2.5), target)

  const desired = Math.atan2(-(target.z - st.pos.z), target.x - st.pos.x)
  let err = desired - st.yaw
  err = Math.atan2(Math.sin(err), Math.cos(err))
  const steer = THREE.MathUtils.clamp(err * 2.6, -1, 1)

  // corner speed: slow down for sharp bends further ahead
  const sharp = Math.abs(curvatureAt(st.loc.dist + 10 + speed * 1.1, 16))
  const cornerMax = THREE.MathUtils.clamp(30 - sharp * 900, 13, 30)

  // rubber band relative to the player
  const gap = st.raceDist - playerRaceDist
  const band = gap > 60 ? 0.93 : gap < -80 ? 1.07 : 1
  st.maxMul = driver.skill * band

  const wanted = Math.min(cornerMax, 30 * st.maxMul)
  return {
    up: st.speed < wanted,
    down: st.speed > wanted + 3,
    steer,
    drift: false,
  }
}
