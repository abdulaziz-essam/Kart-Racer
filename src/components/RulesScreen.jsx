import { SketchScreen, Rough, SketchButton, trophy, W, INK } from './sketch/Sketch'
import { TRACKS, POINTS_TABLE } from '../game/grandprix'
import { LAPS } from '../game/constants'

// "How to win" — four sketched steps shown after pressing Start.

const CARD = (i) => ({ x: 50 + i * 278, y: 150, w: 262, h: 360 })
const STEPS = [
  { title: `Race ${TRACKS.length} tracks`, lines: TRACKS.map((t, i) => `${i + 1}. ${t.name}`) },
  { title: `${LAPS} laps each`, lines: ['Cross the line', `${LAPS} times to finish.`, 'Off the road = slow!'] },
  { title: 'Score points', lines: ['Every race gives', 'points for your place.'] },
  { title: 'Win the cup', lines: ['Most points after', `race ${TRACKS.length} is champion!`] },
]

function stepIcon(rc, i, c) {
  const cx = c.x + c.w / 2, cy = c.y + 150
  const ink = { stroke: INK, strokeWidth: 2.4, roughness: 1.4 }
  if (i === 0) return [ // chequered flag on a pole
    rc.line(cx - 40, cy + 60, cx - 40, cy - 60, { ...ink, seed: 401 }),
    ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((k) => (r + k) % 2 ? null :
      rc.rectangle(cx - 40 + k * 20, cy - 60 + r * 15, 20, 15, { fill: INK, fillStyle: 'solid', stroke: 'none', roughness: 0.8, seed: 410 + r * 4 + k }))),
    rc.rectangle(cx - 40, cy - 60, 80, 60, { ...ink, seed: 430 }),
  ]
  if (i === 1) return [ // lap loop with arrow
    rc.ellipse(cx, cy, 150, 96, { stroke: '#4a4a55', strokeWidth: 12, roughness: 1, seed: 440 }),
    rc.polygon([[cx + 62, cy - 34], [cx + 92, cy - 30], [cx + 70, cy - 8]], { fill: '#2f7bff', fillStyle: 'solid', stroke: '#2f7bff', seed: 441 }),
  ]
  if (i === 2) { // points per place: bar chart
    const bw = 30, base = cy + 70
    return POINTS_TABLE.flatMap((p, k) => [
      rc.rectangle(c.x + 24 + k * 37, base - p * 12, bw, p * 12, { fill: k === 0 ? '#ffcf3a' : '#9ad17a', fillStyle: 'hachure', hachureGap: 4, fillWeight: 2, stroke: INK, strokeWidth: 1.6, roughness: 1.3, seed: 450 + k }),
    ])
  }
  return trophy(rc, cx, cy + 4, 1.1, 470)
}

export default function RulesScreen({ onNext }) {
  return (
    <SketchScreen label="How to win the Grand Prix" frameSeed={5}>
      <Rough draw={(rc) => [
        rc.rectangle(310, 34, 580, 84, { fill: '#9ad17a', fillStyle: 'hachure', hachureGap: 7, fillWeight: 2.2, stroke: 'none', roughness: 2.4, seed: 13 }),
        ...STEPS.flatMap((_, i) => {
          const c = CARD(i)
          return [
            rc.rectangle(c.x, c.y, c.w, c.h, { fill: '#fffdf6', fillStyle: 'solid', stroke: INK, strokeWidth: 2, roughness: 1.5, seed: 500 + i }),
            rc.circle(c.x + 34, c.y + 34, 46, { fill: '#ffd21f', fillStyle: 'solid', stroke: INK, strokeWidth: 2, roughness: 1.4, seed: 510 + i }),
            ...stepIcon(rc, i, c),
            i < 3 ? rc.line(c.x + c.w + 2, c.y + 180, c.x + c.w + 14, c.y + 180, { stroke: INK, strokeWidth: 2, seed: 520 + i }) : null,
          ]
        }),
      ]} />
      <text x={W / 2} y={96} textAnchor="middle" className="intro-title small">How to win</text>
      {STEPS.map((s, i) => {
        const c = CARD(i)
        return (
          <g key={i}>
            <text x={c.x + 34} y={c.y + 44} textAnchor="middle" className="intro-key big">{i + 1}</text>
            <text x={c.x + 66} y={c.y + 44} className="intro-h">{s.title}</text>
            {i === 2 && POINTS_TABLE.map((p, k) => (
              <g key={k}>
                <text x={c.x + 39 + k * 37} y={c.y + 214 - p * 12} textAnchor="middle" className="intro-small">{p}</text>
                <text x={c.x + 39 + k * 37} y={c.y + 244} textAnchor="middle" className="intro-tiny">{['1st', '2nd', '3rd', '4th', '5th', '6th'][k]}</text>
              </g>
            ))}
            {s.lines.map((l, k) => (
              <text key={k} x={c.x + c.w / 2} y={c.y + (i === 0 ? 256 : 280) + k * 24} textAnchor="middle" className="intro-small">{l}</text>
            ))}
          </g>
        )
      })}
      <text x={W / 2} y={560} textAnchor="middle" className="intro-small">Tip: hold SPACE in corners to drift, let go for a speed boost!</text>
      <SketchButton x={375} y={596} w={450} h={74} label="Got it ▶" onClick={onNext} />
    </SketchScreen>
  )
}
