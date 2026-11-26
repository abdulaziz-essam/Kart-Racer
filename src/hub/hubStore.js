import { useSyncExternalStore } from 'react'

// Tiny store shared by the 3D paddock (inside the Canvas) and its DOM HUD:
// the current "Press E" prompt, a short toast message, and pointer-lock state.

let state = { prompt: null, toast: null, locked: false }
const listeners = new Set()
let toastTimer = null

const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }

export const useHub = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => state)

export function setPrompt(prompt) { if (prompt !== state.prompt) set({ prompt }) }
export function setLocked(locked) { if (locked !== state.locked) set({ locked }) }
export function toast(text, good = true) {
  clearTimeout(toastTimer)
  set({ toast: { text, good } })
  toastTimer = setTimeout(() => set({ toast: null }), 2200)
}
