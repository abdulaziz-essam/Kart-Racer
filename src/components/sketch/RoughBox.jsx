import { useLayoutEffect, useRef } from 'react'
import rough from 'roughjs'
import { INK } from './Sketch'

// A hand-drawn (rough.js) frame behind normal HTML content, for HUD panels and
// in-race menus. The sketch is redrawn whenever the box changes size.

function useRoughFrame({ fill, stroke, seed, fillStyle, strokeWidth }) {
  const box = useRef(), svg = useRef()
  useLayoutEffect(() => {
    let last = ''
    const draw = () => {
      const el = box.current; if (!el || !svg.current) return
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight)
      if (!w || !h || `${w}x${h}` === last) return // only redraw on a real size change
      last = `${w}x${h}`
      svg.current.setAttribute('viewBox', `0 0 ${w} ${h}`)
      const rc = rough.svg(svg.current)
      svg.current.replaceChildren(rc.rectangle(3, 3, w - 6, h - 6, { fill, fillStyle, hachureGap: 6, fillWeight: 2, stroke, strokeWidth, roughness: 1.6, seed }))
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [fill, stroke, seed, fillStyle, strokeWidth])
  return { box, svg }
}

/** <div> with a rough.js paper frame behind its children. */
export function RoughBox({ className = '', children, fill = '#fbf6ea', stroke = INK, seed = 1, fillStyle = 'solid', strokeWidth = 2.4, style }) {
  const { box, svg } = useRoughFrame({ fill, stroke, seed, fillStyle, strokeWidth })
  return (
    <div ref={box} className={`rough-box ${className}`} style={style}>
      <svg ref={svg} className="rough-bg" aria-hidden="true" preserveAspectRatio="none" />
      <div className="rough-content">{children}</div>
    </div>
  )
}

/** A <button> drawn in the same hand-drawn style. */
export function RoughButton({ children, onClick, fill = '#ffd21f', seed = 7, className = '', autoFocus }) {
  const { box, svg } = useRoughFrame({ fill, stroke: INK, seed, fillStyle: 'hachure', strokeWidth: 2.6 })
  return (
    <button ref={box} className={`rough-box rough-button ${className}`} onClick={onClick} autoFocus={autoFocus}>
      <svg ref={svg} className="rough-bg" aria-hidden="true" preserveAspectRatio="none" />
      <span className="rough-content">{children}</span>
    </button>
  )
}
