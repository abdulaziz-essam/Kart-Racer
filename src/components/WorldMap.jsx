import { useEffect, useRef, useState } from 'react'
import rough from 'roughjs'
import { SketchScreen, Rough, fitTrack, sketchTrack, helmet, trophy, W, H, INK } from './sketch/Sketch'
import { TRACKS } from '../game/grandprix'
import { useProfile, paintColor } from '../game/profile'
import { PRACTICE_TRACK } from '../game/practice'

// "Kart Island": the hand-drawn world outside the races. A dotted road runs from
// the Paddock through the four Grand Prix tracks to the championship cup; a side
// road leads to the Test Track. Click a place to go there.

const ISLAND = [[110, 300], [180, 190], [330, 150], [480, 120], [640, 140], [790, 110], [930, 150], [1060, 210], [1110, 320],
  [1080, 450], [980, 560], [820, 610], [640, 640], [460, 630], [300, 600], [170, 540], [100, 430]]
const PADDOCK = { x: 210, y: 400 }
const TEST = { x: 330, y: 545 }
const RACES = [{ x: 430, y: 300 }, { x: 610, y: 470 }, { x: 770, y: 255 }, { x: 950, y: 430 }]
const CUP = { x: 1030, y: 250 }
const ROAD = [PADDOCK, { x: 320, y: 340 }, RACES[0], { x: 500, y: 420 }, RACES[1], { x: 700, y: 360 }, RACES[2], { x: 880, y: 330 }, RACES[3], { x: 1010, y: 340 }, CUP]
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th']
const MEDAL = { 1: '#ffcf3a', 2: '#c9d3dc', 3: '#d99a5b' }

/** Hit area: invisible, clickable, with the shared hover style. */
const Hit = ({ x, y, w, h, onClick }) => <rect x={x} y={y} width={w} height={h} rx={12} fill="transparent" className="sketch-hit" onClick={onClick} />

/** A ring that keeps redrawing itself, so the next stop looks alive. */
function BoilingRing({ x, y, d, color }) {
  const g = useRef()
  useEffect(() => {
    const svg = g.current.ownerSVGElement, rc = rough.svg(svg)
    let seed = 1
    const paint = () => g.current.replaceChildren(rc.circle(x, y, d, { stroke: color, strokeWidth: 3.5, roughness: 2.2, seed: (seed = (seed % 4) + 1) }))
    paint()
    const id = setInterval(paint, 220)
    return () => clearInterval(id)
  }, [x, y, d, color])
  return <g ref={g} />
}

export default function WorldMap({ raceIndex, onRace, onPaddock, onPractice, finished }) {
  const profile = useProfile()
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2400); return () => clearTimeout(t) }, [msg])
  const status = (i) => (finished || i < raceIndex ? 'done' : i === raceIndex ? 'next' : 'locked')
  const here = finished ? CUP : RACES[raceIndex]
  const key = JSON.stringify(profile.trophies) + raceIndex + profile.paint + finished

  const clickRace = (i) => {
    const st = status(i)
    if (st === 'next') onRace()
    else if (st === 'done') setMsg({ ok: true, text: `${TRACKS[i].name}: already raced this Grand Prix` })
    else setMsg({ ok: false, text: `Locked: win your way through race ${raceIndex + 1} first` })
  }

  return (
    <SketchScreen label="Kart Island world map" frameSeed={41}>
      <Rough deps={[key]} draw={(rc) => [
        // sea, waves, island
        rc.rectangle(30, 30, W - 60, H - 60, { fill: '#bfe3f5', fillStyle: 'hachure', hachureGap: 12, fillWeight: 1, stroke: 'none', roughness: 1.5, seed: 2 }),
        ...[[70, 120], [140, 640], [1120, 600], [1140, 110], [520, 680], [870, 80]].map(([x, y], i) =>
          rc.arc(x, y, 40, 16, Math.PI, Math.PI * 2, false, { stroke: '#4c8fbf', strokeWidth: 2, seed: 3 + i })),
        rc.curve([...ISLAND, ISLAND[0], ISLAND[1]], { fill: '#d4ecbd', fillStyle: 'cross-hatch', hachureGap: 16, fillWeight: 0.8, stroke: INK, strokeWidth: 2.6, roughness: 1.6, seed: 10 }),
        // landmarks: lake by Lakeside, mountains by Twisty Hills, sand by the canyon, trees
        rc.ellipse(700, 545, 130, 70, { fill: '#7fbde8', fillStyle: 'solid', stroke: '#3a7fb0', strokeWidth: 2, seed: 20 }),
        ...[[835, 205, 60], [890, 225, 46], [700, 190, 44]].map(([x, y, s], i) =>
          rc.polygon([[x - s, y + s * 0.7], [x, y - s * 0.7], [x + s, y + s * 0.7]], { fill: '#a9a18f', fillStyle: 'hachure', hachureGap: 5, stroke: INK, strokeWidth: 1.8, seed: 21 + i })),
        rc.ellipse(1000, 500, 170, 90, { fill: '#f0d2a8', fillStyle: 'hachure', hachureGap: 6, fillWeight: 1.5, stroke: '#c69a5a', strokeWidth: 1.5, seed: 25 }),
        ...[[300, 230], [345, 210], [520, 220], [560, 560], [250, 300], [470, 560], [880, 520], [640, 230]].map(([x, y], i) =>
          rc.circle(x, y, 26, { fill: '#5d9b3f', fillStyle: 'solid', stroke: INK, strokeWidth: 1.4, roughness: 1.6, seed: 30 + i })),
        // roads
        rc.curve(ROAD.map((p) => [p.x, p.y]), { stroke: '#8a5a2b', strokeWidth: 5, roughness: 1.2, strokeLineDash: [14, 10], seed: 40 }),
        rc.curve([[PADDOCK.x, PADDOCK.y], [260, 500], [TEST.x, TEST.y]], { stroke: '#8a5a2b', strokeWidth: 4, roughness: 1.2, strokeLineDash: [10, 9], seed: 41 }),
        // Paddock: tents + flag
        ...[[-30, 0, '#e3261c'], [10, -10, '#2f7bff'], [45, 4, '#ffbf1a']].map(([dx, dy, c], i) =>
          rc.polygon([[PADDOCK.x + dx - 22, PADDOCK.y + dy + 18], [PADDOCK.x + dx, PADDOCK.y + dy - 20], [PADDOCK.x + dx + 22, PADDOCK.y + dy + 18]],
            { fill: c, fillStyle: 'hachure', hachureGap: 4, fillWeight: 2, stroke: INK, strokeWidth: 2, seed: 50 + i })),
        // Test Track
        ...sketchTrack(rc, fitTrack(PRACTICE_TRACK, { x: TEST.x - 55, y: TEST.y - 32, w: 110, h: 64 }, 6, 2), { width: 6, seed: 60, flag: false }),
        // race stops: mini track sketch + numbered badge
        ...RACES.flatMap((p, i) => {
          const st = status(i), best = profile.trophies?.[TRACKS[i].id]
          return [
            rc.rectangle(p.x - 70, p.y - 128, 140, 86, { fill: st === 'locked' ? '#e8e8e8' : '#fffdf6', fillStyle: 'solid', stroke: INK, strokeWidth: 1.6, roughness: 1.3, seed: 70 + i }),
            ...sketchTrack(rc, fitTrack(TRACKS[i], { x: p.x - 70, y: p.y - 128, w: 140, h: 86 }, 12, 3), { width: 5, seed: 80 + i * 5, flag: false }),
            rc.circle(p.x, p.y, 54, {
              fill: st === 'done' ? (MEDAL[best] || '#9ad17a') : st === 'next' ? '#ffd21f' : '#c9c9c9',
              fillStyle: st === 'locked' ? 'hachure' : 'solid', hachureGap: 5, stroke: INK, strokeWidth: 2.4, roughness: 1.3, seed: 100 + i,
            }),
          ]
        }),
        // championship cup at the end of the road
        ...trophy(rc, CUP.x, CUP.y - 6, 0.6, 120),
        // you are here: your helmet with a little flag, just left of the stop
        rc.line(here.x - 52, here.y - 2, here.x - 52, here.y - 52, { stroke: INK, strokeWidth: 2.2, seed: 130 }),
        rc.polygon([[here.x - 52, here.y - 52], [here.x - 28, here.y - 44], [here.x - 52, here.y - 36]], { fill: '#e3261c', fillStyle: 'solid', stroke: INK, seed: 131 }),
        helmet(rc, here.x - 52, here.y + 8, 30, paintColor(profile), true, 132),
        // title + coins
        rc.rectangle(400, 36, 400, 70, { fill: '#ffd21f', fillStyle: 'hachure', hachureGap: 7, fillWeight: 2.2, stroke: 'none', roughness: 2.4, seed: 140 }),
        rc.rectangle(980, 44, 170, 58, { fill: '#fff6cf', fillStyle: 'solid', stroke: INK, strokeWidth: 2.2, roughness: 1.4, seed: 141 }),
        rc.circle(1012, 73, 32, { fill: '#ffcf3a', fillStyle: 'solid', stroke: '#8a5a10', strokeWidth: 2.4, seed: 142 }),
      ]} />
      {!finished && <BoilingRing x={RACES[raceIndex].x} y={RACES[raceIndex].y} d={74} color="#e3261c" />}

      <text x={W / 2} y={88} textAnchor="middle" className="intro-title small">Kart Island</text>
      <text x={1040} y={84} className="intro-title small" style={{ fontSize: 36 }}>{profile.coins}</text>

      {/* Paddock */}
      <text x={PADDOCK.x + 8} y={PADDOCK.y + 52} textAnchor="middle" className="intro-name">Paddock</text>
      <text x={PADDOCK.x + 8} y={PADDOCK.y + 74} textAnchor="middle" className="intro-tiny">store · garage</text>
      <Hit x={PADDOCK.x - 62} y={PADDOCK.y - 34} w={140} h={116} onClick={onPaddock} />

      {/* Test Track */}
      <text x={TEST.x} y={TEST.y + 54} textAnchor="middle" className="intro-name">Test Track</text>
      <text x={TEST.x} y={TEST.y + 74} textAnchor="middle" className="intro-tiny">practice laps{profile.practiceBest ? ` · best ${profile.practiceBest.toFixed(2)}s` : ''}</text>
      <Hit x={TEST.x - 64} y={TEST.y - 40} w={128} h={122} onClick={onPractice} />

      {/* race stops */}
      {RACES.map((p, i) => {
        const st = status(i), best = profile.trophies?.[TRACKS[i].id]
        return (
          <g key={i}>
            <text x={p.x} y={p.y + 10} textAnchor="middle" className="intro-key big">{st === 'locked' ? '🔒' : st === 'done' ? '✔' : i + 1}</text>
            <text x={p.x} y={p.y + 52} textAnchor="middle" className={st === 'next' ? 'intro-name me' : 'intro-name'}>{TRACKS[i].name}</text>
            <text x={p.x} y={p.y + 72} textAnchor="middle" className="intro-tiny">
              {st === 'next' ? 'next race · click to go!' : st === 'done' ? 'done' : 'locked'}{best ? ` · best ${ORD[best]}` : ''}
            </text>
            <Hit x={p.x - 72} y={p.y - 130} w={144} h={212} onClick={() => clickRace(i)} />
          </g>
        )
      })}
      <text x={CUP.x} y={CUP.y + 66} textAnchor="middle" className="intro-name">Champion's Cup</text>
      <text x={CUP.x} y={CUP.y + 86} textAnchor="middle" className="intro-tiny">cups won: {profile.cups || 0}</text>

      <text x={56} y={H - 44} className="intro-small">Click a place to go there</text>
      {msg && <text x={W / 2} y={H - 40} textAnchor="middle" className="intro-name" style={{ fill: msg.ok ? '#1fae4b' : '#e3261c' }}>{msg.text}</text>}
    </SketchScreen>
  )
}
