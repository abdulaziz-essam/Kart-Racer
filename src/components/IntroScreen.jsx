import { useProgress } from '@react-three/drei'
import { SketchScreen, Rough, SketchButton, fitTrack, sketchTrack, helmet, W, H, INK } from './sketch/Sketch'
import { RACERS } from '../game/constants'
import { TRACKS } from '../game/grandprix'

// Hand-drawn title screen: the four Grand Prix tracks, the racers, the
// controls and a Start button (enabled once the first track has loaded).

const MAP = { x: 50, y: 150, w: 590, h: 500 }
const SIDE = { x: 680, w: 470 }
const BTN = { x: 690, y: 600, w: 450, h: 74 }
const KEYS = [
  { k: 'W', alt: '↑', label: 'drive' },
  { k: 'S', alt: '↓', label: 'brake' },
  { k: 'A D', alt: '← →', label: 'steer' },
  { k: 'SPACE', alt: '', label: 'drift → boost', wide: true },
  { k: 'R', alt: '', label: 'respawn' },
]
const cell = (i) => ({ x: MAP.x + 10 + (i % 2) * 290, y: MAP.y + 14 + Math.floor(i / 2) * 242, w: 280, h: 220 })

export default function IntroScreen({ ready, onStart }) {
  const { progress } = useProgress()
  const canStart = ready && progress >= 100
  return (
    <SketchScreen label="Kart Rally title screen">
      <Rough draw={(rc) => [
        rc.rectangle(350, 34, 500, 84, { fill: '#ffd21f', fillStyle: 'hachure', hachureGap: 7, fillWeight: 2.2, stroke: 'none', roughness: 2.4, seed: 11 }),
        rc.line(380, 116, 820, 111, { stroke: '#e3261c', strokeWidth: 4, roughness: 2.2, seed: 12 }),
        rc.rectangle(MAP.x, MAP.y, MAP.w, MAP.h, { fill: '#cfe8b8', fillStyle: 'cross-hatch', hachureGap: 14, fillWeight: 0.8, stroke: INK, strokeWidth: 2, roughness: 1.4, seed: 21 }),
        ...TRACKS.flatMap((t, i) => sketchTrack(rc, fitTrack(t, cell(i), 34, 3), { width: 9, seed: 30 + i * 10 })),
        rc.rectangle(SIDE.x, 150, SIDE.w, 220, { stroke: INK, strokeWidth: 2, roughness: 1.5, seed: 31 }),
        ...RACERS.map((r, i) => helmet(rc, SIDE.x + 80 + (i % 3) * 150, 222 + Math.floor(i / 3) * 92, 46, r.paint, r.player, 40 + i)),
        rc.ellipse(SIDE.x + 80, 222, 70, 64, { stroke: '#e3261c', strokeWidth: 2.4, roughness: 2.2, seed: 50 }),
        rc.rectangle(SIDE.x, 390, SIDE.w, 190, { stroke: INK, strokeWidth: 2, roughness: 1.5, seed: 61 }),
        ...KEYS.map((key, i) => rc.rectangle(SIDE.x + 24 + (i % 2) * 225, 440 + Math.floor(i / 2) * 44, key.wide ? 96 : 64, 34, { fill: '#ffffff', fillStyle: 'solid', stroke: INK, strokeWidth: 1.6, roughness: 1.1, seed: 70 + i })),
      ]} />
      <text x={W / 2} y={102} textAnchor="middle" className="intro-title">Kart Rally</text>
      <text x={MAP.x + 20} y={MAP.y - 14} className="intro-h">Grand Prix · 4 tracks</text>
      {TRACKS.map((t, i) => {
        const c = cell(i)
        return <text key={t.id} x={c.x + c.w / 2} y={c.y + c.h - 2} textAnchor="middle" className="intro-small">{i + 1}. {t.name}</text>
      })}
      <text x={SIDE.x + 4} y={142} className="intro-h">Racers</text>
      {RACERS.map((r, i) => (
        <text key={r.name} x={SIDE.x + 80 + (i % 3) * 150} y={222 + Math.floor(i / 3) * 92 + 44} textAnchor="middle" className={r.player ? 'intro-name me' : 'intro-name'}>{r.name}</text>
      ))}
      <text x={SIDE.x + 4} y={428} className="intro-h">Controls</text>
      {KEYS.map((key, i) => {
        const x = SIDE.x + 24 + (i % 2) * 225, y = 440 + Math.floor(i / 2) * 44
        return (
          <g key={key.k}>
            <text x={x + (key.wide ? 48 : 32)} y={y + 23} textAnchor="middle" className="intro-key">{key.k}</text>
            <text x={x + (key.wide ? 106 : 74)} y={y + 23} className="intro-small">{key.alt ? `${key.alt}  ` : ''}{key.label}</text>
          </g>
        )
      })}
      <SketchButton {...BTN} label="Start Grand Prix ▶" enabled={canStart} progress={progress} onClick={onStart} />
      <text x={W / 2} y={H - 30} textAnchor="middle" className="intro-credit">Press Enter to start · cars by Kenney (CC0)</text>
    </SketchScreen>
  )
}
