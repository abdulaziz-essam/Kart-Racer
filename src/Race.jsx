import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useTexture } from '@react-three/drei'
import { useKeys } from './useKeys'
import { prepareKart, makeKart } from './game/kartModel'
import { makeKenneyKart } from './game/kenneyModel'
import { createKartState } from './game/physics'
import { pointAt, yawAt, LAP_LENGTH } from './game/path'
import { useRaceLoop } from './hooks/useRaceLoop'
import { RACERS, KENNEY_MODELS, GRID_ORDER, LINE_S, kenneyUrl } from './game/constants'

export { LAPS, RACERS } from './game/constants'

export default function Race({ track, hud, onPhase, onFinish }) {
  const { scene: kartScene } = useGLTF('/models/kart.glb')
  const kenney = useGLTF(KENNEY_MODELS.map(kenneyUrl))
  const palette = useTexture('/models/kenney/Textures/variation-b.png', (t) => {
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false
    t.needsUpdate = true
  })
  const keys = useKeys()
  const sun = useRef()

  const proto = useMemo(() => prepareKart(kartScene), [kartScene])

  const field = useMemo(() => RACERS.map((r, idx) => {
    const slot = GRID_ORDER.indexOf(idx)
    const row = Math.floor(slot / 2), col = slot % 2
    const s = LINE_S - 7 - row * 8 - col * 3.5
    const lat = col ? -2.8 : 2.8
    const pos = pointAt(s, lat)
    const st = createKartState(pos, yawAt(s), { offset: s - LINE_S })
    if (st.offset > 0) st.offset -= LAP_LENGTH
    const kart = r.model
      ? makeKenneyKart(kenney[KENNEY_MODELS.indexOf(r.model)].scene, palette, r.paint)
      : makeKart(proto, r.paint, r.helmet)
    return { ...r, idx, st, kart, ai: r.player ? null : { lane: lat * 0.6, phase: idx * 1.7, skill: r.skill } }
  }), [proto, kenney, palette])

  useRaceLoop({ field, track, hud, keys, sun, onPhase, onFinish })

  return (
    <>
      <directionalLight ref={sun} intensity={3.6} color="#ffeccc" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45}
        shadow-camera-near={1} shadow-camera-far={220} />
      {field.map((kt) => <primitive key={kt.idx} object={kt.kart.root} />)}
    </>
  )
}

useGLTF.preload('/models/kart.glb')
KENNEY_MODELS.forEach((m) => useGLTF.preload(kenneyUrl(m)))
