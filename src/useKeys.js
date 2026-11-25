import { useEffect, useRef } from 'react'

const MAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'drift', KeyR: 'reset',
}

export function useKeys() {
  const keys = useRef({ up: false, down: false, left: false, right: false, drift: false, reset: false })
  useEffect(() => {
    const set = (v) => (e) => {
      const k = MAP[e.code]
      if (!k) return
      e.preventDefault()
      keys.current[k] = v
    }
    const down = set(true), up = set(false)
    const blur = () => Object.keys(keys.current).forEach((k) => (keys.current[k] = false))
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
  return keys
}
