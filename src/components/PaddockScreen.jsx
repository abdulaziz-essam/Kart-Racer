import { useEffect, useState } from 'react'
import { SketchScreen, Rough, SketchButton, fitTrack, sketchTrack, helmet, trophy, W, INK } from './sketch/Sketch'
import {
  CARS, PAINTS, UPGRADES, useProfile, paintColor, playerStats,
  buyOrSelectCar, buyOrSelectPaint, buyUpgrade, nextOwnedCar,
} from '../game/profile'
import { TRACKS, sortedStandings } from '../game/grandprix'
import { RACERS, LAPS } from '../game/constants'

// The paddock between races, hand-drawn with rough.js in three sections:
//   STORE  (tabs: cars · paint · upgrades)  |  GARAGE (your car, trophies)  |  RACE (next track, start)

const COL = [{ x: 40, w: 360, title: 'Store', color: '#2f7bff' }, { x: 420, w: 360, title: 'Garage', color: '#8a35e0' }, { x: 800, w: 360, title: 'Race', color: '#e3261c' }]
const TOP = 140, BOTTOM = 676
const TABS = ['Cars', 'Paint', 'Upgrades']
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th']
const MEDAL = { 1: '#ffcf3a', 2: '#c9d3dc', 3: '#d99a5b' }
const stars = (v) => '★'.repeat(Math.max(1, Math.min(5, Math.round((v - 0.88) * 25))))

/** An invisible click area on top of something drawn by rough.js. */
const Hit = ({ x, y, w, h, onClick, disabled }) => (
  <rect x={x} y={y} width={w} height={h} fill="transparent" className={disabled ? '' : 'sketch-hit'} onClick={disabled ? undefined : onClick} />
)

/** Little side-on kart sketch in the player's paint. */
function kartSketch(rc, x, y, color, seed) {
  const ink = { stroke: INK, strokeWidth: 2.4, roughness: 1.3 }
  return [
    rc.path(`M ${x - 110} ${y + 20} L ${x - 100} ${y - 18} Q ${x - 40} ${y - 40} ${x + 30} ${y - 28} L ${x + 105} ${y - 14} Q ${x + 122} ${y} ${x + 110} ${y + 20} Z`,
      { ...ink, fill: color, fillStyle: 'hachure', hachureGap: 5, fillWeight: 2.4, seed }),
    rc.path(`M ${x - 105} ${y - 16} L ${x - 112} ${y - 52} L ${x - 72} ${y - 50} L ${x - 70} ${y - 24}`, { ...ink, fill: INK, fillStyle: 'solid', seed: seed + 1 }),
    helmet(rc, x - 8, y - 52, 40, '#ffffff', false, seed + 2),
    rc.circle(x - 70, y + 26, 46, { ...ink, fill: '#2b2a33', fillStyle: 'solid', seed: seed + 3 }),
    rc.circle(x + 72, y + 26, 46, { ...ink, fill: '#2b2a33', fillStyle: 'solid', seed: seed + 4 }),
    rc.circle(x - 70, y + 26, 18, { stroke: '#ffd21f', strokeWidth: 3, seed: seed + 5 }),
    rc.circle(x + 72, y + 26, 18, { stroke: '#ffd21f', strokeWidth: 3, seed: seed + 6 }),
  ]
}

export default function PaddockScreen({ raceIndex, standings, onRace, onPractice, onMap }) {
  const profile = useProfile()
  const [tab, setTab] = useState('Cars')
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2400); return () => clearTimeout(t) }, [msg])
  const say = (res) => setMsg(res)

  const track = TRACKS[raceIndex]
  const car = CARS.find((c) => c.id === profile.car)
  const stats = playerStats(profile)
  const rows = sortedStandings(standings, RACERS).slice(0, 3)
  const S = COL[0], G = COL[1], R = COL[2]
  const map = { x: R.x + 20, y: 250, w: R.w - 40, h: 190 }
  const key = JSON.stringify(profile) + tab + raceIndex // redraw the sketch when any of these change

  /* ---------- Store tab contents (positions shared by drawing, text and click areas) ---------- */
  const carRow = (i) => ({ x: S.x + 14, y: 214 + i * 88, w: S.w - 28, h: 78 })
  const paintCell = (i) => ({ x: S.x + 22 + (i % 4) * 82, y: 230 + Math.floor(i / 4) * 150, w: 70, h: 120 })
  const upRow = (i) => ({ x: S.x + 14, y: 220 + i * 140, w: S.w - 28, h: 124 })
  const btn = (r) => ({ x: r.x + r.w - 104, y: r.y + r.h / 2 - 20, w: 92, h: 40 })

  const carState = (c) => profile.car === c.id ? 'on' : profile.cars.includes(c.id) ? 'owned' : 'locked'
  const paintState = (p) => profile.paint === p.id ? 'on' : profile.paints.includes(p.id) ? 'owned' : 'locked'

  return (
    <SketchScreen label="Paddock: store, garage and race" frameSeed={31}>
      <Rough deps={[key]} draw={(rc) => [
        // title + coins
        rc.rectangle(420, 34, 360, 80, { fill: '#ffd21f', fillStyle: 'hachure', hachureGap: 7, fillWeight: 2.2, stroke: 'none', roughness: 2.4, seed: 17 }),
        rc.rectangle(980, 44, 170, 62, { fill: '#fff6cf', fillStyle: 'solid', stroke: INK, strokeWidth: 2.2, roughness: 1.4, seed: 18 }),
        rc.circle(1012, 75, 34, { fill: '#ffcf3a', fillStyle: 'solid', stroke: '#8a5a10', strokeWidth: 2.4, roughness: 1.2, seed: 19 }),
        // three section frames with coloured headers
        ...COL.flatMap((c, i) => [
          rc.rectangle(c.x, TOP, c.w, BOTTOM - TOP, { stroke: INK, strokeWidth: 2.2, roughness: 1.5, seed: 40 + i }),
          rc.line(c.x + 16, TOP + 2, c.x + 150, TOP + 2, { stroke: c.color, strokeWidth: 6, roughness: 1.8, seed: 50 + i }),
        ]),

        /* STORE */
        ...TABS.map((t, i) => rc.rectangle(S.x + 14 + i * 112, 158, 104, 40, t === tab
          ? { fill: '#2f7bff', fillStyle: 'solid', stroke: INK, strokeWidth: 2, roughness: 1.2, seed: 60 + i }
          : { stroke: INK, strokeWidth: 1.6, roughness: 1.2, seed: 60 + i })),
        ...(tab === 'Cars' ? CARS.flatMap((c, i) => {
          const r = carRow(i), st = carState(c), b = btn(r)
          return [
            rc.rectangle(r.x, r.y, r.w, r.h, { stroke: st === 'on' ? '#1fae4b' : INK, strokeWidth: st === 'on' ? 3 : 1.4, roughness: 1.3, seed: 70 + i }),
            helmet(rc, r.x + 32, r.y + r.h / 2, 38, st === 'locked' ? '#b9bdc4' : paintColor(profile), st === 'on', 80 + i),
            st === 'on' ? null : rc.rectangle(b.x, b.y, b.w, b.h, { fill: st === 'owned' ? '#9ad17a' : '#ffd21f', fillStyle: 'solid', stroke: INK, strokeWidth: 2, roughness: 1.3, seed: 90 + i }),
          ]
        }) : []),
        ...(tab === 'Paint' ? PAINTS.flatMap((p, i) => {
          const c = paintCell(i), st = paintState(p)
          return [
            rc.rectangle(c.x, c.y, c.w, c.w, { fill: p.color, fillStyle: st === 'locked' ? 'hachure' : 'solid', hachureGap: 5, fillWeight: 2.5, stroke: INK, strokeWidth: st === 'on' ? 4 : 1.8, roughness: 1.4, seed: 100 + i }),
            st === 'on' ? rc.ellipse(c.x + c.w / 2, c.y + c.w / 2, c.w + 22, c.w + 22, { stroke: '#1fae4b', strokeWidth: 3, roughness: 2, seed: 120 + i }) : null,
          ]
        }) : []),
        ...(tab === 'Upgrades' ? UPGRADES.flatMap((u, i) => {
          const r = upRow(i), level = profile.upgrades[u.id], b = btn(r)
          return [
            rc.rectangle(r.x, r.y, r.w, r.h, { stroke: INK, strokeWidth: 1.4, roughness: 1.3, seed: 130 + i }),
            ...[0, 1, 2].map((k) => rc.rectangle(r.x + 16 + k * 34, r.y + 74, 26, 26, { fill: k < level ? '#26c26b' : '#ffffff', fillStyle: 'solid', stroke: INK, strokeWidth: 1.6, roughness: 1.2, seed: 140 + i * 3 + k })),
            level < 3 ? rc.rectangle(b.x, b.y + 22, b.w, b.h, { fill: '#ffd21f', fillStyle: 'solid', stroke: INK, strokeWidth: 2, roughness: 1.3, seed: 150 + i }) : null,
          ]
        }) : []),

        /* GARAGE */
        ...kartSketch(rc, G.x + G.w / 2, 276, paintColor(profile), 200),
        ...[['Speed', stats.speedMul], ['Grip', stats.gripMul], ['Accel', stats.accelMul], ['Boost', stats.boostMul]].flatMap(([, v], i) => [
          rc.rectangle(G.x + 110, 336 + i * 30, 200, 18, { stroke: INK, strokeWidth: 1.4, roughness: 1, seed: 210 + i }),
          rc.rectangle(G.x + 110, 336 + i * 30, Math.max(8, Math.min(200, (v - 0.85) / 0.7 * 200)), 18, { fill: '#8a35e0', fillStyle: 'hachure', hachureGap: 4, fillWeight: 2, stroke: 'none', roughness: 1.2, seed: 220 + i }),
        ]),
        profile.cars.length > 1 ? rc.rectangle(G.x + 90, 462, 180, 40, { fill: '#e9d9ff', fillStyle: 'solid', stroke: INK, strokeWidth: 2, roughness: 1.3, seed: 230 }) : null,
        ...TRACKS.map((t, i) => {
          const best = profile.trophies?.[t.id]
          return rc.circle(G.x + 34, 548 + i * 28, 20, { fill: MEDAL[best] || '#e4e4e4', fillStyle: 'solid', stroke: INK, strokeWidth: 1.6, roughness: 1.2, seed: 240 + i })
        }),
        ...trophy(rc, G.x + G.w - 56, 590, 0.55, 250),

        /* RACE */
        rc.rectangle(map.x, map.y, map.w, map.h, { fill: track.theme === 'canyon' ? '#f0d2a8' : '#cfe8b8', fillStyle: 'cross-hatch', hachureGap: 14, fillWeight: 0.8, stroke: INK, strokeWidth: 1.8, roughness: 1.4, seed: 300 }),
        ...sketchTrack(rc, fitTrack(track, map, 28, 2), { width: 10, seed: 310 + raceIndex * 7 }),
        ...rows.map((r, i) => helmet(rc, R.x + 34, 486 + i * 28, 20, r.paint, r.player, 330 + i)),
        rc.rectangle(R.x + 20, 572, R.w - 40, 34, { fill: '#cfe8ff', fillStyle: 'solid', stroke: INK, strokeWidth: 1.8, roughness: 1.3, seed: 340 }),
      ]} />

      {/* ---------- text and click areas ---------- */}
      <text x={W / 2} y={92} textAnchor="middle" className="intro-title small">Paddock</text>
      {onMap && (
        <g>
          <Rough draw={(rc) => [rc.rectangle(50, 48, 150, 50, { fill: '#cfe8ff', fillStyle: 'hachure', hachureGap: 5, fillWeight: 2, stroke: INK, strokeWidth: 2.2, roughness: 1.4, seed: 16 })]} />
          <text x={125} y={81} textAnchor="middle" className="intro-key big">◀ Map</text>
          <Hit x={50} y={48} w={150} h={50} onClick={onMap} />
        </g>
      )}
      <text x={1040} y={86} className="intro-title small" style={{ fontSize: 38 }}>{profile.coins}</text>
      {COL.map((c) => <text key={c.title} x={c.x + 18} y={TOP - 10} className="intro-h" style={{ fill: c.color }}>{c.title}</text>)}

      {/* STORE */}
      {TABS.map((t, i) => (
        <g key={t}>
          <text x={S.x + 66 + i * 112} y={185} textAnchor="middle" className="intro-name" style={{ fill: t === tab ? '#fff' : '#2b2a33' }}>{t}</text>
          <Hit x={S.x + 14 + i * 112} y={158} w={104} h={40} onClick={() => setTab(t)} />
        </g>
      ))}
      {tab === 'Cars' && CARS.map((c, i) => {
        const r = carRow(i), st = carState(c), b = btn(r)
        return (
          <g key={c.id}>
            <text x={r.x + 62} y={r.y + 30} className="intro-name">{c.name}</text>
            <text x={r.x + 62} y={r.y + 56} className="intro-tiny">Speed {stars(c.speed)} · Grip {stars(c.grip)}</text>
            {st === 'on'
              ? <text x={b.x + b.w / 2} y={b.y + 27} textAnchor="middle" className="intro-key" style={{ fill: '#1fae4b' }}>✔ driving</text>
              : <text x={b.x + b.w / 2} y={b.y + 27} textAnchor="middle" className="intro-key">{st === 'owned' ? 'Drive' : `${c.price} c`}</text>}
            <Hit {...b} disabled={st === 'on'} onClick={() => say(buyOrSelectCar(c.id))} />
          </g>
        )
      })}
      {tab === 'Paint' && PAINTS.map((p, i) => {
        const c = paintCell(i), st = paintState(p)
        return (
          <g key={p.id}>
            <text x={c.x + c.w / 2} y={c.y + c.w + 24} textAnchor="middle" className="intro-small" style={{ textTransform: 'capitalize' }}>{p.id}</text>
            <text x={c.x + c.w / 2} y={c.y + c.w + 46} textAnchor="middle" className="intro-tiny" style={{ fill: st === 'on' ? '#1fae4b' : st === 'owned' ? '#2f7bff' : '#e3261c' }}>{st === 'on' ? '✔ on' : st === 'owned' ? 'owned' : `${p.price} c`}</text>
            <Hit x={c.x} y={c.y} w={c.w} h={c.h} disabled={st === 'on'} onClick={() => say(buyOrSelectPaint(p.id))} />
          </g>
        )
      })}
      {tab === 'Upgrades' && UPGRADES.map((u, i) => {
        const r = upRow(i), level = profile.upgrades[u.id], b = btn(r)
        return (
          <g key={u.id}>
            <text x={r.x + 16} y={r.y + 34} className="intro-name">{u.name}</text>
            <text x={r.x + 16} y={r.y + 60} className="intro-tiny">{u.label} per level</text>
            <text x={r.x + 124} y={r.y + 93} className="intro-tiny">level {level}/3</text>
            {level < 3
              ? <text x={b.x + b.w / 2} y={b.y + 49} textAnchor="middle" className="intro-key">{u.costs[level]} c</text>
              : <text x={b.x + b.w / 2} y={b.y + 49} textAnchor="middle" className="intro-key" style={{ fill: '#1fae4b' }}>MAX</text>}
            <Hit x={b.x} y={b.y + 22} w={b.w} h={b.h} disabled={level >= 3} onClick={() => say(buyUpgrade(u.id))} />
          </g>
        )
      })}

      {/* GARAGE */}
      <text x={G.x + G.w / 2} y={190} textAnchor="middle" className="intro-h">{car.name}</text>
      {['Speed', 'Grip', 'Accel', 'Boost'].map((label, i) => <text key={label} x={G.x + 24} y={350 + i * 30} className="intro-small">{label}</text>)}
      {profile.cars.length > 1
        ? <><text x={G.x + 180} y={489} textAnchor="middle" className="intro-key">Switch car ▶</text><Hit x={G.x + 90} y={462} w={180} h={40} onClick={() => say(nextOwnedCar())} /></>
        : <text x={G.x + 180} y={489} textAnchor="middle" className="intro-tiny">Buy more cars in the Store</text>}
      <text x={G.x + 18} y={528} className="intro-small">Trophies</text>
      {TRACKS.map((t, i) => {
        const best = profile.trophies?.[t.id]
        return <text key={t.id} x={G.x + 54} y={554 + i * 28} className="intro-tiny">{t.name}: {best ? ORD[best] : '—'}</text>
      })}
      <text x={G.x + G.w - 56} y={660} textAnchor="middle" className="intro-tiny">Cups: {profile.cups || 0}</text>
      <text x={G.x + 18} y={664} className="intro-tiny">Test best: {profile.practiceBest ? profile.practiceBest.toFixed(2) + 's' : '--'}</text>

      {/* RACE */}
      <text x={R.x + 20} y={196} className="intro-h small">Race {raceIndex + 1} of {TRACKS.length}</text>
      <text x={R.x + 20} y={234} className="intro-name">{track.name} · {(track.length / 1000).toFixed(2)} km · {LAPS} laps</text>
      <text x={R.x + 20} y={470} className="intro-small">Championship</text>
      {rows.map((r, i) => (
        <text key={r.name} x={R.x + 54} y={493 + i * 28} className={r.player ? 'intro-name me' : 'intro-small'}>{i + 1}. {r.name} · {r.points} pts</text>
      ))}
      <text x={R.x + R.w / 2} y={595} textAnchor="middle" className="intro-small">Test Track (practice laps)</text>
      <Hit x={R.x + 20} y={572} w={R.w - 40} h={34} onClick={onPractice} />
      <SketchButton x={R.x + 20} y={614} w={R.w - 40} h={52} label="Start race ▶" onClick={onRace} />

      {msg && <text x={W / 2} y={697} textAnchor="middle" className="intro-name" style={{ fill: msg.ok ? '#1fae4b' : '#e3261c' }}>{msg.message}</text>}
    </SketchScreen>
  )
}
