import { useProgress } from '@react-three/drei'
import { SketchScreen, Rough, SketchButton, fitTrack, sketchTrack, helmet, trophy, W, INK } from './sketch/Sketch'
import { TRACKS, POINTS_TABLE, sortedStandings } from '../game/grandprix'
import { RACERS, LAPS } from '../game/constants'
import { THEMES } from '../game/themes'

// Hand-drawn screens between races: the track card before each race, the
// race result + championship table after it, and the final podium.

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th']
const paintOf = (name) => RACERS.find((r) => r.name === name)?.paint || '#999'

/** Season standings as sketched bars. */
function standingsBars(rc, rows, box, seed) {
  const max = Math.max(10, ...rows.map((r) => r.points))
  return rows.flatMap((r, i) => [
    helmet(rc, box.x + 18, box.y + 20 + i * box.row, 26, r.paint, r.player, seed + i),
    r.points > 0 && rc.rectangle(box.x + 140, box.y + 8 + i * box.row, Math.max(8, (box.w - 210) * r.points / max), box.row - 18,
      { fill: r.paint, fillStyle: r.player ? 'cross-hatch' : 'hachure', hachureGap: 5, fillWeight: 2, stroke: INK, strokeWidth: 1.6, roughness: 1.4, seed: seed + 10 + i }),
  ])
}
function StandingsText({ rows, box }) {
  return rows.map((r, i) => (
    <g key={r.name}>
      <text x={box.x + 40} y={box.y + 27 + i * box.row} className={r.player ? 'intro-name me' : 'intro-name'}>{r.name}</text>
      <text x={box.x + box.w - 10} y={box.y + 27 + i * box.row} textAnchor="end" className="intro-key">{r.points} pts</text>
    </g>
  ))
}

/* ---------------- before each race ---------------- */
export function TrackCard({ raceIndex, standings, ready, onGo }) {
  const { progress } = useProgress()
  const track = TRACKS[raceIndex]
  const theme = THEMES[track.theme]
  const map = { x: 50, y: 150, w: 620, h: 480 }
  const rows = sortedStandings(standings, RACERS)
  const box = { x: 712, y: 300, w: 440, row: 43 }
  return (
    <SketchScreen label={`Race ${raceIndex + 1}: ${track.name}`} frameSeed={7 + raceIndex}>
      <Rough deps={[raceIndex]} draw={(rc) => [
        rc.rectangle(300, 34, 600, 84, { fill: '#ffd21f', fillStyle: 'hachure', hachureGap: 7, fillWeight: 2.2, stroke: 'none', roughness: 2.4, seed: 14 + raceIndex }),
        rc.rectangle(map.x, map.y, map.w, map.h, { fill: track.theme === 'canyon' ? '#f0d2a8' : '#cfe8b8', fillStyle: 'cross-hatch', hachureGap: 14, fillWeight: 0.8, stroke: INK, strokeWidth: 2, roughness: 1.4, seed: 22 }),
        ...sketchTrack(rc, fitTrack(track, map, 50, 2), { width: 16, seed: 60 + raceIndex * 7 }),
        rc.rectangle(712, 150, 440, 100, { stroke: INK, strokeWidth: 2, roughness: 1.5, seed: 33 }),
        rc.rectangle(712, 266, 440, 300, { stroke: INK, strokeWidth: 2, roughness: 1.5, seed: 34 }),
        ...standingsBars(rc, rows, box, 600),
        ...TRACKS.map((_, i) => rc.circle(560 + i * 40, 676, 22, { fill: i < raceIndex ? '#26c26b' : i === raceIndex ? '#ffd21f' : '#ffffff', fillStyle: 'solid', stroke: INK, strokeWidth: 1.8, roughness: 1.2, seed: 700 + i })),
      ]} />
      <text x={W / 2} y={98} textAnchor="middle" className="intro-title small">Race {raceIndex + 1} of {TRACKS.length}</text>
      <text x={map.x + 20} y={map.y - 14} className="intro-h">{track.name}</text>
      <text x={730} y={186} className="intro-small">Length: {(track.length / 1000).toFixed(2)} km · {LAPS} laps</text>
      <text x={730} y={214} className="intro-small">Scenery: {theme.label}</text>
      <text x={730} y={242} className="intro-small">Win: {POINTS_TABLE[0]} pts · 2nd: {POINTS_TABLE[1]} · 3rd: {POINTS_TABLE[2]}</text>
      <text x={726} y={292} className="intro-h small">{raceIndex === 0 ? 'Points so far: none yet' : 'Championship so far'}</text>
      <StandingsText rows={rows} box={box} />
      <text x={548} y={683} textAnchor="end" className="intro-small">Grand Prix</text>
      <SketchButton x={712} y={586} w={440} h={74} label="Race! ▶" enabled={ready && progress >= 100} progress={progress} onClick={onGo} />
    </SketchScreen>
  )
}

/* ---------------- after each race ---------------- */
export function StandingsScreen({ raceIndex, result, standings, onNext }) {
  const track = TRACKS[raceIndex]
  const last = raceIndex === TRACKS.length - 1
  const rows = sortedStandings(standings, RACERS, result)
  const box = { x: 650, y: 186, w: 500, row: 58 }
  const me = result.findIndex((r) => r.player)
  return (
    <SketchScreen label={`Results: ${track.name}`} frameSeed={11 + raceIndex}>
      <Rough deps={[raceIndex]} draw={(rc) => [
        rc.rectangle(260, 34, 680, 84, { fill: me === 0 ? '#ffd21f' : '#9ad17a', fillStyle: 'hachure', hachureGap: 7, fillWeight: 2.2, stroke: 'none', roughness: 2.4, seed: 15 }),
        rc.rectangle(50, 150, 560, 420, { stroke: INK, strokeWidth: 2, roughness: 1.5, seed: 35 }),
        ...result.flatMap((r, i) => [
          helmet(rc, 92, 210 + i * 60, 34, paintOf(r.name), r.player, 800 + i),
          r.player ? rc.rectangle(64, 184 + i * 60, 530, 52, { stroke: '#e3261c', strokeWidth: 2.4, roughness: 2, seed: 820 }) : null,
        ]),
        rc.rectangle(630, 150, 520, 420, { stroke: INK, strokeWidth: 2, roughness: 1.5, seed: 36 }),
        ...standingsBars(rc, rows, box, 840),
      ]} />
      <text x={W / 2} y={98} textAnchor="middle" className="intro-title small">{me === 0 ? 'You won!' : `You finished ${ORD[me]}`}</text>
      <text x={64} y={140} className="intro-h">Race {raceIndex + 1}: {track.name}</text>
      {result.map((r, i) => (
        <g key={r.name}>
          <text x={124} y={218 + i * 60} className={r.player ? 'intro-name me' : 'intro-name'}>{ORD[i]}  {r.name}</text>
          <text x={430} y={218 + i * 60} textAnchor="end" className="intro-small">{r.time ? `${r.time.toFixed(1)}s` : 'still racing'}</text>
          <text x={584} y={218 + i * 60} textAnchor="end" className="intro-key big">+{POINTS_TABLE[i]}</text>
        </g>
      ))}
      <text x={646} y={140} className="intro-h">Championship after race {raceIndex + 1}</text>
      <StandingsText rows={rows} box={box} />
      <SketchButton x={375} y={596} w={450} h={74} label={last ? 'See the champion 🏆' : 'Next race ▶'} onClick={onNext} />
    </SketchScreen>
  )
}

/* ---------------- end of the Grand Prix ---------------- */
export function FinalScreen({ standings, lastResult, onRestart }) {
  const rows = sortedStandings(standings, RACERS, lastResult)
  const champ = rows[0]
  const podium = [rows[1], rows[0], rows[2]] // 2nd, 1st, 3rd
  const heights = [150, 210, 110]
  return (
    <SketchScreen label="Grand Prix champion" frameSeed={21}>
      <Rough draw={(rc) => [
        rc.rectangle(240, 34, 720, 84, { fill: '#ffd21f', fillStyle: 'hachure', hachureGap: 7, fillWeight: 2.2, stroke: 'none', roughness: 2.4, seed: 16 }),
        ...trophy(rc, 600, 210, 1.3, 900),
        ...podium.flatMap((r, i) => [
          rc.rectangle(330 + i * 180, 560 - heights[i], 170, heights[i], { fill: ['#c9d3dc', '#ffcf3a', '#d99a5b'][i], fillStyle: 'hachure', hachureGap: 6, fillWeight: 2, stroke: INK, strokeWidth: 2.4, roughness: 1.4, seed: 910 + i }),
          helmet(rc, 415 + i * 180, 560 - heights[i] - 34, 52, r.paint, r.player, 920 + i),
        ]),
        rc.line(250, 562, 950, 560, { stroke: INK, strokeWidth: 3, roughness: 1.6, seed: 930 }),
      ]} />
      <text x={W / 2} y={98} textAnchor="middle" className="intro-title small">{champ.player ? 'You are the champion!' : `${champ.name} wins the cup!`}</text>
      {podium.map((r, i) => (
        <g key={r.name}>
          <text x={415 + i * 180} y={560 - heights[i] + 40} textAnchor="middle" className="intro-key big">{[2, 1, 3][i]}</text>
          <text x={415 + i * 180} y={560 - heights[i] + 70} textAnchor="middle" className={r.player ? 'intro-name me' : 'intro-name'}>{r.name}</text>
          <text x={415 + i * 180} y={560 - heights[i] + 96} textAnchor="middle" className="intro-small">{r.points} pts</text>
        </g>
      ))}
      <text x={W / 2} y={600} textAnchor="middle" className="intro-small">
        {rows.slice(3).map((r, i) => `${i + 4}. ${r.name} ${r.points} pts`).join('   ·   ')}
      </text>
      <SketchButton x={375} y={618} w={450} h={70} label="Play again ↺" onClick={onRestart} />
    </SketchScreen>
  )
}
