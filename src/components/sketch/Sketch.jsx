import { createContext, useContext, useEffect, useRef } from 'react'
import rough from 'roughjs'

// Small toolkit for the hand-drawn (rough.js) screens: a paper page with a
// 1200x720 SVG, layers that rough.js draws into, a "boiling" button and a
// helper that sketches a track outline from its racing line.

export const W = 1200, H = 720
export const INK = '#2b2a33'
const SvgCtx = createContext(null)

/** Full-screen paper page; children are SVG elements in a 1200x720 space. */
export function SketchScreen({ label, children, frameSeed = 3 }) {
  const svg = useRef()
  return (
    <div className="intro">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
        <SvgCtx.Provider value={svg}>
          <Rough draw={(rc) => [rc.rectangle(18, 18, W - 36, H - 36, { stroke: INK, strokeWidth: 2.2, roughness: 1.6, seed: frameSeed })]} />
          {children}
        </SvgCtx.Provider>
      </svg>
    </div>
  )
}

/** A <g> that rough.js draws into. draw(rc) returns an array of SVG nodes. */
export function Rough({ draw, deps = [] }) {
  const svg = useContext(SvgCtx)
  const g = useRef()
  useEffect(() => {
    const rc = rough.svg(svg.current)
    g.current.replaceChildren(...draw(rc).filter(Boolean))
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return <g ref={g} />
}

/** Hand-drawn button that "boils" (redraws with a new seed) while enabled. */
export function SketchButton({ x, y, w, h, label, enabled = true, progress, onClick, fill = '#ffd21f', hotkey = true }) {
  const svg = useContext(SvgCtx)
  const g = useRef()
  useEffect(() => {
    const rc = rough.svg(svg.current)
    const paint = (seed) => {
      if (enabled) g.current.replaceChildren(rc.rectangle(x, y, w, h, { fill, fillStyle: 'hachure', hachureGap: 5, fillWeight: 3, stroke: INK, strokeWidth: 3, roughness: 2, seed }))
      else g.current.replaceChildren(
        rc.rectangle(x, y, w, h, { stroke: INK, strokeWidth: 2, roughness: 1.6, seed: 90 }),
        rc.rectangle(x + 8, y + 8, Math.max(6, (w - 16) * (progress ?? 0) / 100), h - 16, { fill: '#9ad17a', fillStyle: 'zigzag', hachureGap: 6, stroke: 'none', roughness: 1.6, seed: 91 }),
      )
    }
    let seed = 101
    paint(seed)
    if (!enabled) return
    const id = setInterval(() => paint(seed = seed === 103 ? 101 : seed + 1), 260)
    return () => clearInterval(id)
  }, [enabled, progress, x, y, w, h, fill]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled || !hotkey) return
    const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); onClick?.() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, hotkey, onClick])
  return (
    <>
      <g ref={g} />
      <g className={enabled ? 'intro-btn ready' : 'intro-btn'} onClick={enabled ? onClick : undefined} role="button" tabIndex={enabled ? 0 : -1} aria-disabled={!enabled}>
        <rect x={x} y={y} width={w} height={h} fill="transparent" />
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" className="intro-btn-text">
          {enabled ? label : `Loading… ${Math.round(progress ?? 0)}%`}
        </text>
      </g>
    </>
  )
}

/** Track racing-line points (track JSON) fitted into a box; point 0 is the start line. */
export function fitTrack(track, box, pad = 24, every = 2) {
  const xs = track.points.map((p) => p[0]), zs = track.points.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const s = Math.min((box.w - pad * 2) / (maxX - minX), (box.h - pad * 2) / (maxZ - minZ))
  const ox = box.x + (box.w - (maxX - minX) * s) / 2, oy = box.y + (box.h - (maxZ - minZ) * s) / 2
  return track.points.filter((_, i) => i % every === 0).map((p) => [ox + (p[0] - minX) * s, oy + (p[1] - minZ) * s])
}

/** Sketch a track: dark road, red/white kerb hint, start flag. Returns SVG nodes. */
export function sketchTrack(rc, pts, { width = 14, seed = 20, flag = true } = {}) {
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ') + ' Z'
  const nodes = [
    rc.path(d, { stroke: '#4a4a55', strokeWidth: width, roughness: 0.8, seed }),
    rc.path(d, { stroke: '#e3261c', strokeWidth: Math.max(1.2, width / 9), roughness: 1.2, seed: seed + 1 }),
    rc.path(d, { stroke: '#ffffff', strokeWidth: Math.max(1, width / 10), roughness: 1.6, seed: seed + 2 }),
  ]
  if (flag) {
    const [sx, sy] = pts[0]
    nodes.push(rc.line(sx, sy - 4, sx + 1, sy - 36, { stroke: INK, strokeWidth: 2.2, seed: seed + 3 }))
    nodes.push(rc.polygon([[sx + 1, sy - 36], [sx + 24, sy - 30], [sx + 1, sy - 23]], { fill: '#e3261c', fillStyle: 'solid', stroke: INK, roughness: 1.1, seed: seed + 4 }))
  }
  return nodes
}

/** Little helmet: a hachured circle in a team colour. */
export const helmet = (rc, x, y, d, color, solid, seed) =>
  rc.circle(x, y, d, { fill: color, fillStyle: solid ? 'solid' : 'hachure', hachureGap: 4, fillWeight: 2, stroke: INK, strokeWidth: solid ? 3 : 1.6, roughness: 1.4, seed })

/** A trophy cup sketch centred at (x, y). */
export function trophy(rc, x, y, s = 1, seed = 300) {
  const gold = { fill: '#ffcf3a', fillStyle: 'hachure', hachureGap: 4, fillWeight: 2, stroke: INK, strokeWidth: 2.2, roughness: 1.4 }
  return [
    rc.path(`M ${x - 40 * s} ${y - 50 * s} L ${x + 40 * s} ${y - 50 * s} Q ${x + 38 * s} ${y + 10 * s} ${x} ${y + 18 * s} Q ${x - 38 * s} ${y + 10 * s} ${x - 40 * s} ${y - 50 * s} Z`, { ...gold, seed }),
    rc.arc(x - 40 * s, y - 28 * s, 36 * s, 40 * s, Math.PI / 2, Math.PI * 1.5, false, { stroke: INK, strokeWidth: 2.2, seed: seed + 1 }),
    rc.arc(x + 40 * s, y - 28 * s, 36 * s, 40 * s, -Math.PI / 2, Math.PI / 2, false, { stroke: INK, strokeWidth: 2.2, seed: seed + 2 }),
    rc.rectangle(x - 6 * s, y + 18 * s, 12 * s, 20 * s, { ...gold, seed: seed + 3 }),
    rc.rectangle(x - 30 * s, y + 38 * s, 60 * s, 16 * s, { fill: '#8a5a2b', fillStyle: 'solid', stroke: INK, strokeWidth: 2, roughness: 1.2, seed: seed + 4 }),
  ]
}
