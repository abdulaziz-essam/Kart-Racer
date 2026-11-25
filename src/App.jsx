import { Suspense, useCallback, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { SoftShadows } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping, SMAA, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import SkyDome from './SkyDome'
import Track from './Track'
import Scenery from './Scenery'
import Race from './Race'
import Loader from './components/Loader'
import Hud from './components/Hud'
import Results from './components/Results'
import StudioEnvironment from './components/StudioEnvironment'

export default function App() {
  const hud = useRef({})
  const [track, setTrack] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [results, setResults] = useState(null)
  const [raceId, setRaceId] = useState(0)

  const onTrack = useCallback((t) => setTrack(t), [])
  const onFinish = useCallback((r) => setResults(r), [])
  const restart = useCallback(() => { setResults(null); setRaceId((n) => n + 1) }, [])

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 60, near: 0.3, far: 4000, position: [200, 6, 20] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={['#cfe0ec', 420, 1700]} />
        <hemisphereLight args={['#cfe6ff', '#6b8f3a', 0.65]} />
        <SoftShadows size={18} samples={12} focus={0.6} />
        <SkyDome />
        <StudioEnvironment />
        <Suspense fallback={null}>
          <Track onReady={onTrack} />
          {track && <Scenery trees={track.trees} />}
          {track && <Race key={raceId} track={track} hud={hud} onPhase={setPhase} onFinish={onFinish} />}
        </Suspense>
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={1.6} distanceFalloff={1.2} intensity={2.2} color="#20263a" halfRes quality="medium" />
          <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.15} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <HueSaturation saturation={0.05} />
          <BrightnessContrast contrast={0.06} />
          <Vignette offset={0.32} darkness={0.42} />
          <SMAA />
        </EffectComposer>
      </Canvas>
      <Hud hud={hud} phase={phase} />
      {results && <Results results={results} onRestart={restart} />}
      <Loader />
    </>
  )
}
