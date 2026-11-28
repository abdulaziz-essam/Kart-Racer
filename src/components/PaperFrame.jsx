import { useLayoutEffect, useRef } from 'react'
import rough from 'roughjs'

// Paper-cutout look, part 3: a white paper border around the race view with a
// hand-drawn (rough.js) ink edge, like the game is a cut-out sheet of paper.
export default function PaperFrame() {
  const svg = useRef()
  useLayoutEffect(() => {
    const draw = () => {
      const el = svg.current; if (!el) return
      const w = window.innerWidth, h = window.innerHeight, m = 14
      el.setAttribute('viewBox', `0 0 ${w} ${h}`)
      const rc = rough.svg(el)
      // white paper margin = a big white path with the inner rectangle cut out
      const paper = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      paper.setAttribute('d', `M0 0H${w}V${h}H0Z M${m} ${m}V${h - m}H${w - m}V${m}Z`)
      paper.setAttribute('fill', '#fbf6ea'); paper.setAttribute('fill-rule', 'evenodd')
      el.replaceChildren(
        paper,
        rc.rectangle(m, m, w - 2 * m, h - 2 * m, { stroke: '#1d1b24', strokeWidth: 3.2, roughness: 1.8, bowing: 1.5, seed: 9 }),
        rc.rectangle(m + 5, m + 4, w - 2 * m - 9, h - 2 * m - 7, { stroke: '#1d1b24', strokeWidth: 1.2, roughness: 2.2, seed: 10 }),
      )
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])
  return <svg ref={svg} className="paper-frame" aria-hidden="true" preserveAspectRatio="none" />
}
