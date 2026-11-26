import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { SoftShadows } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping, SMAA, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import SkyDome from './SkyDome'
import Track from './Track'
import Scenery from './Scenery'
import Race from './Race'
import IntroScreen from './components/IntroScreen'
import RulesScreen from './components/RulesScreen'
import { TrackCard, StandingsScreen, FinalScreen } from './components/RaceScreens'
import Hud from './components/Hud'
import StudioEnvironment from './components/StudioEnvironment'
import { setTrack } from './game/path'
import { TRACKS, raceOrder, addRace } from './game/grandprix'

// Grand Prix flow:
//   intro -> rules -> card (race N) -> race -> standings -> card (N+1) ... -> final
// The hand-drawn screens (rough.js) sit on top of the 3D canvas; the next
// track is built behind the card screen while you read it.

// Dev shortcut: ?race=3 opens the card for race 3 (handy for checking tracks)
const DEV_RACE = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get('race')) || 0 : 0

export default function App() {
  const hud = useRef({})
  const [screen, setScreen] = useState(DEV_RACE ? 'card' : 'intro')
  const [raceIndex, setRaceIndex] = useState(Math.max(0, DEV_RACE - 1))
  const [loadedTrack, setLoadedTrack] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [standings, setStandings] = useState({})
  const [lastResult, setLastResult] = useState([])
  const [attempt, setAttempt] = useState(0) // remounts the track for a new Grand Prix
  const finishedRef = useRef(false)

  // switch the racing line before anything for this race renders
  useMemo(() => setTrack(TRACKS[raceIndex]), [raceIndex])
  const trackKey = `${raceIndex}-${attempt}`
  const ready = loadedTrack?.key === trackKey

  const onTrack = useCallback((t) => setLoadedTrack({ ...t, key: trackKey }), [trackKey])

  const onFinish = useCallback((_results, field) => {
    if (finishedRef.current) return // first call = the player crossed the line
    finishedRef.current = true
    const result = raceOrder(field).map((k) => ({ name: k.name, player: !!k.player, paint: k.paint, time: k.st.finished ? k.st.finishTime : null }))
    setLastResult(result)
    setStandings((prevStandings) => addRace(prevStandings, result))
    setTimeout(() => setScreen('standings'), 2500) // let the finish sink in first
  }, [])

  const goRace = useCallback(() => { finishedRef.current = false; setScreen('race') }, [])
  const nextRace = useCallback(() => {
    if (raceIndex + 1 >= TRACKS.length) { setScreen('final'); return }
    setRaceIndex((i) => i + 1)
    setScreen('card')
  }, [raceIndex])
  const restart = useCallback(() => {
    setStandings({}); setLastResult([])
    setRaceIndex(0); setAttempt((n) => n + 1)
    setScreen('card')
  }, [])

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 60, near: 0.3, far: 4000, position: [0, 30, 60] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={['#cfe0ec', 420, 1700]} />
        <hemisphereLight args={['#cfe6ff', '#6b8f3a', 0.65]} />
        <SoftShadows size={18} samples={12} focus={0.6} />
        <SkyDome />
        <StudioEnvironment />
        <Suspense fallback={null}>
          <Track key={`track-${trackKey}`} onReady={onTrack} />
          {ready && <Scenery key={`scenery-${trackKey}`} trees={loadedTrack.trees} />}
          {ready && screen === 'race' && <Race key={`race-${trackKey}`} track={loadedTrack} hud={hud} onPhase={setPhase} onFinish={onFinish} />}
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
      {screen === 'race' && <Hud hud={hud} phase={phase} race={`${raceIndex + 1}/${TRACKS.length}`} />}
      {screen === 'intro' && <IntroScreen ready={ready} onStart={() => setScreen('rules')} />}
      {screen === 'rules' && <RulesScreen onNext={() => setScreen('card')} />}
      {screen === 'card' && <TrackCard raceIndex={raceIndex} standings={standings} ready={ready} onGo={goRace} />}
      {screen === 'standings' && <StandingsScreen raceIndex={raceIndex} result={lastResult} standings={standings} onNext={nextRace} />}
      {screen === 'final' && <FinalScreen standings={standings} lastResult={lastResult} onRestart={restart} />}
    </>
  )
}
