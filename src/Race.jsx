import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useTexture } from '@react-three/drei'
import { useKeys } from './useKeys'
import { makeKenneyKart } from './game/kenneyModel'
import { createKartState } from './game/physics'
import { pointAt, yawAt, LAP_LENGTH } from './game/path'
import { useRaceLoop } from './hooks/useRaceLoop'
import { RACERS, KENNEY_MODELS, GRID_ORDER, LINE_S, kenneyUrl, gridSlot } from './game/constants'
import { getProfile, playerStats, paintColor } from './game/profile'

export { LAPS, RACERS } from './game/constants'

export default function Race({ track, hud, onPhase, onFinish, practice = false, paused = false }) {
  const kenneyModels = useGLTF(KENNEY_MODELS.map(kenneyUrl))
  const palette = useTexture('/models/kenney/Textures/variation-b.png', (t) => {
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace
    // crisp colour blocks up close, mipmaps far away (no sparkly pixels on distant cars)
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4
    t.needsUpdate = true
  })
  const keys = useKeys()
  const sun = useRef()

  // practice on the Test Track: just you
  const field = useMemo(() => RACERS.filter((r) => !practice || r.player).map((baseConfig, idx) => {
    // the player drives the car, paint and upgrades chosen in the paddock garage
    const profile = getProfile()
    const stats = baseConfig.player ? playerStats(profile) : null
    const racerConfig = baseConfig.player ? { ...baseConfig, model: stats.model, paint: paintColor(profile) } : baseConfig
    const { s, lat } = gridSlot(practice ? 0 : GRID_ORDER.indexOf(idx))
    const pos = pointAt(s, lat)
    const kartState = createKartState(pos, yawAt(s), { offset: s - LINE_S, ...(stats && { speedMul: stats.speedMul, gripMul: stats.gripMul, accelMul: stats.accelMul, boostMul: stats.boostMul }) })
    if (kartState.offset > 0) kartState.offset -= LAP_LENGTH
    const kart = makeKenneyKart(kenneyModels[KENNEY_MODELS.indexOf(racerConfig.model)].scene, palette, racerConfig.paint)
    return { ...racerConfig, idx, st: kartState, kart, ai: racerConfig.player ? null : { lane: lat * 0.6, phase: idx * 1.7, skill: racerConfig.skill } }
  }), [kenneyModels, palette, practice])

  useRaceLoop({ field, track, hud, keys, sun, onPhase, onFinish, practice, paused })

  return (
    <>
      <directionalLight ref={sun} intensity={3.6} color="#ffeccc" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45}
        shadow-camera-near={1} shadow-camera-far={220} />
      {field.map((racer) => <primitive key={racer.idx} object={racer.kart.root} />)}
    </>
  )
}

KENNEY_MODELS.forEach((modelName) => useGLTF.preload(kenneyUrl(modelName)))
