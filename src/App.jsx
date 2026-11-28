import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { TRACKS, raceOrder, addRace, sortedStandings } from './game/grandprix'
import { RACE_PAYOUT, addCoins, recordRace, recordCup } from './game/profile'
import { PRACTICE_TRACK } from './game/practice'
import { RACERS } from './game/constants'
import PaddockScreen from './components/PaddockScreen'
import WorldMap from './components/WorldMap'
import PauseMenu from './components/PauseMenu'
import PaperOutlines from './components/PaperOutlines'
import { PaperEffect } from './components/PaperEffect'
import PaperFrame from './components/PaperFrame'

// Grand Prix flow:
//   intro -> rules -> map (Kart Island) -> card (race N) -> race -> standings (+coins)
//   -> map -> ... -> final -> map. From the map: Paddock (store/garage), Test Track.
// The paddock is a hand-drawn (rough.js) screen: Store · Garage · Race.
// The hand-drawn screens (rough.js) sit on top of the 3D canvas; the next
// track is built behind the card screen while you read it.

// Dev shortcut: ?race=3 opens the card for race 3 (handy for checking tracks)
const DEV_RACE = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get('race')) || 0 : 0
// Dev shortcuts: ?hub=1 opens the paddock, ?map=1 the world map
const DEV_HUB = import.meta.env.DEV && new URLSearchParams(window.location.search).has('hub')
const DEV_MAP = import.meta.env.DEV && new URLSearchParams(window.location.search).has('map')

export default function App() {
  const hud = useRef({})
  const [screen, setScreen] = useState(DEV_MAP ? 'map' : DEV_HUB ? 'hub' : DEV_RACE ? 'card' : 'intro')
  const [raceIndex, setRaceIndex] = useState(Math.max(0, DEV_RACE - 1))
  const [loadedTrack, setLoadedTrack] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [standings, setStandings] = useState({})
  const [lastResult, setLastResult] = useState([])
  const [lastCoins, setLastCoins] = useState(0)
  const [attempt, setAttempt] = useState(0) // remounts the track for a new Grand Prix
  const finishedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(0) // bumps to restart the current race/practice

  // switch the racing line before anything for this race renders
  // (the Test Track replaces the Grand Prix circuit while practising)
  const practice = screen === 'practice'
  const activeTrack = practice ? PRACTICE_TRACK : TRACKS[raceIndex]
  useMemo(() => setTrack(activeTrack), [activeTrack])
  const trackKey = practice ? 'practice' : `${raceIndex}-${attempt}`
  const ready = loadedTrack?.key === trackKey

  const onTrack = useCallback((t) => setLoadedTrack({ ...t, key: trackKey }), [trackKey])

  const onFinish = useCallback((_results, field) => {
    if (finishedRef.current) return // first call = the player crossed the line
    finishedRef.current = true
    const result = raceOrder(field).map((k) => ({ name: k.name, player: !!k.player, paint: k.paint, time: k.st.finished ? k.st.finishTime : null }))
    setLastResult(result)
    setStandings((prevStandings) => addRace(prevStandings, result))
    const place = result.findIndex((r) => r.player)
    const coins = RACE_PAYOUT[place] ?? 0
    addCoins(coins); setLastCoins(coins)
    recordRace(TRACKS[raceIndexRef.current].id, place + 1) // Trophy Hall
    setTimeout(() => setScreen('standings'), 2500) // let the finish sink in first
  }, [])

  const goRace = useCallback(() => { finishedRef.current = false; setScreen('race') }, [])
  const nextRace = useCallback(() => {
    if (raceIndex + 1 >= TRACKS.length) {
      if (sortedStandings(standings, RACERS, lastResult)[0]?.player) recordCup()
      setScreen('final'); return
    }
    setRaceIndex((i) => i + 1)
    setScreen('map') // back to Kart Island: shop, practise or race on
  }, [raceIndex, standings, lastResult])
  const restart = useCallback(() => {
    setStandings({}); setLastResult([])
    setRaceIndex(0); setAttempt((n) => n + 1)
    setScreen('map')
  }, [])
  const toGate = useCallback(() => setScreen('card'), [])
  const toPractice = useCallback(() => setScreen('practice'), [])
  const raceIndexRef = useRef(raceIndex)
  raceIndexRef.current = raceIndex
  // Esc pauses a race or practice session (hand-drawn pause menu)
  const driving = screen === 'race' || practice
  useEffect(() => {
    if (!driving) { setPaused(false); return }
    const onKey = (e) => { if (e.code === 'Escape') setPaused((p) => !p) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [driving])
  const resume = useCallback(() => setPaused(false), [])
  const restartRun = useCallback(() => { finishedRef.current = false; setPaused(false); setRun((n) => n + 1) }, [])
  const quitToMap = useCallback(() => { setPaused(false); setScreen('map') }, [])
  const toMap = useCallback(() => setScreen('map'), [])
  const toPaddock = useCallback(() => setScreen('hub'), [])
  const inHub = screen === 'hub'

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
        {/* paper-cutout look: thick ink outlines on cars, props and trees */}
        <PaperOutlines />
        <Suspense fallback={null}>
          {/* the next circuit builds behind the paddock screen */}
          <Track key={`track-${trackKey}`} onReady={onTrack} />
          {ready && <Scenery key={`scenery-${trackKey}`} trees={loadedTrack.trees} />}
          {ready && screen === 'race' && <Race key={`race-${trackKey}-${run}`} track={loadedTrack} hud={hud} onPhase={setPhase} onFinish={onFinish} paused={paused} />}
          {ready && practice && <Race key={`race-practice-${run}`} practice track={loadedTrack} hud={hud} onPhase={setPhase} paused={paused} />}
        </Suspense>
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={1.6} distanceFalloff={1.2} intensity={2.2} color="#20263a" halfRes quality="medium" />
          <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.15} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <PaperEffect />
          <HueSaturation saturation={0.05} />
          <BrightnessContrast contrast={0.06} />
          <Vignette offset={0.32} darkness={0.42} />
          <SMAA />
        </EffectComposer>
      </Canvas>
      {screen === 'race' && <Hud hud={hud} phase={phase} race={`${raceIndex + 1}/${TRACKS.length}`} />}
      {practice && <Hud hud={hud} phase={phase} race="TEST" />}
      {practice && <div className="practice-tip">Test Track · practice laps · <b>Esc</b> pause</div>}
      {driving && <PaperFrame />}
      {driving && paused && <PauseMenu practice={practice} onResume={resume} onRestart={restartRun} onQuit={quitToMap} />}
      {screen === 'intro' && <IntroScreen ready={ready} onStart={() => setScreen('rules')} />}
      {screen === 'rules' && <RulesScreen onNext={toMap} />}
      {screen === 'map' && <WorldMap raceIndex={raceIndex} onRace={toGate} onPaddock={toPaddock} onPractice={toPractice} />}
      {inHub && <PaddockScreen raceIndex={raceIndex} standings={standings} onRace={toGate} onPractice={toPractice} onMap={toMap} />}
      {screen === 'card' && <TrackCard raceIndex={raceIndex} standings={standings} ready={ready} onGo={goRace} />}
      {screen === 'standings' && <StandingsScreen raceIndex={raceIndex} result={lastResult} standings={standings} coins={lastCoins} onNext={nextRace} />}
      {screen === 'final' && <FinalScreen standings={standings} lastResult={lastResult} onRestart={restart} />}
    </>
  )
}
