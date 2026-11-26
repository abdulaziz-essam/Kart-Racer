import { useSyncExternalStore } from 'react'

// The player's garage: coins, owned cars and paints, upgrade levels and the
// current selection. Saved in the browser (localStorage) so progress is kept
// between visits; everything still works if storage is blocked.

export const START_COINS = 150
/** Coins for finishing 1st..6th in a race. */
export const RACE_PAYOUT = [120, 90, 70, 50, 35, 25]

/** Cars (Kenney Toy Car Kit models) with handling stats as multipliers. */
export const CARS = [
  { id: 'racer', name: 'Racer', price: 0, speed: 1.0, grip: 1.0, accel: 1.0, blurb: 'Balanced all-rounder' },
  { id: 'racer-low', name: 'Low Rider', price: 220, speed: 1.02, grip: 1.12, accel: 1.0, blurb: 'Sticks to corners' },
  { id: 'vintage-racer', name: 'Vintage', price: 300, speed: 1.0, grip: 1.05, accel: 1.15, blurb: 'Quick off the line' },
  { id: 'speedster', name: 'Speedster', price: 380, speed: 1.07, grip: 0.98, accel: 1.05, blurb: 'High top speed' },
  { id: 'drag-racer', name: 'Dragster', price: 520, speed: 1.12, grip: 0.92, accel: 1.12, blurb: 'Rocket on straights' },
]

export const PAINTS = [
  { id: 'blue', color: '#1f6bff', price: 0 },
  { id: 'red', color: '#e3261c', price: 60 },
  { id: 'yellow', color: '#ffbf1a', price: 60 },
  { id: 'green', color: '#1fae4b', price: 60 },
  { id: 'purple', color: '#8a35e0', price: 60 },
  { id: 'orange', color: '#ff6a00', price: 60 },
  { id: 'pink', color: '#ff5fb2', price: 80 },
  { id: 'black', color: '#24242c', price: 100 },
]

/** Upgrades: 3 levels each; cost of the next level and what one level adds. */
export const UPGRADES = [
  { id: 'engine', name: 'Engine', costs: [100, 180, 280], per: 0.03, label: '+3% top speed' },
  { id: 'tyres', name: 'Tyres', costs: [90, 160, 250], per: 0.08, label: '+8% grip' },
  { id: 'boost', name: 'Boost', costs: [80, 150, 230], per: 0.2, label: '+20% drift boost' },
]

const KEY = 'kart-rally-profile-v1'
const fresh = () => ({
  coins: START_COINS,
  cars: ['racer'], paints: ['blue'],
  upgrades: { engine: 0, tyres: 0, boost: 0 },
  car: 'racer', paint: 'blue',
})

function load() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY))
    if (saved && typeof saved.coins === 'number') return { ...fresh(), ...saved, upgrades: { ...fresh().upgrades, ...saved.upgrades } }
  } catch { /* storage blocked or corrupt: start fresh */ }
  return fresh()
}

let state = load()
const listeners = new Set()
function set(next) {
  state = next
  try { window.localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export const getProfile = () => state
export function useProfile() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, getProfile)
}

/* ---------- actions (return { ok, message }) ---------- */
const fail = (message) => ({ ok: false, message })

export function addCoins(n) { set({ ...state, coins: state.coins + n }) }

export function buyOrSelectCar(id) {
  const car = CARS.find((c) => c.id === id)
  if (state.cars.includes(id)) { set({ ...state, car: id }); return { ok: true, message: `${car.name} selected` } }
  if (state.coins < car.price) return fail(`Need ${car.price - state.coins} more coins`)
  set({ ...state, coins: state.coins - car.price, cars: [...state.cars, id], car: id })
  return { ok: true, message: `Bought the ${car.name}!` }
}

export function buyOrSelectPaint(id) {
  const paint = PAINTS.find((p) => p.id === id)
  if (state.paints.includes(id)) { set({ ...state, paint: id }); return { ok: true, message: `${id} paint on` } }
  if (state.coins < paint.price) return fail(`Need ${paint.price - state.coins} more coins`)
  set({ ...state, coins: state.coins - paint.price, paints: [...state.paints, id], paint: id })
  return { ok: true, message: `New ${id} paint!` }
}

export function buyUpgrade(id) {
  const up = UPGRADES.find((u) => u.id === id)
  const level = state.upgrades[id]
  if (level >= up.costs.length) return fail(`${up.name} is maxed out`)
  const cost = up.costs[level]
  if (state.coins < cost) return fail(`Need ${cost - state.coins} more coins`)
  set({ ...state, coins: state.coins - cost, upgrades: { ...state.upgrades, [id]: level + 1 } })
  return { ok: true, message: `${up.name} level ${level + 1}!` }
}

export function resetProfile() { set(fresh()) }

/* ---------- what the race uses ---------- */
export const paintColor = (p = state) => PAINTS.find((x) => x.id === p.paint)?.color || PAINTS[0].color

/** Multipliers for the player's kart from the chosen car + upgrades. */
export function playerStats(p = state) {
  const car = CARS.find((c) => c.id === p.car) || CARS[0]
  const lvl = (id) => p.upgrades[id] * UPGRADES.find((u) => u.id === id).per
  return {
    model: car.id,
    speedMul: car.speed * (1 + lvl('engine')),
    gripMul: car.grip * (1 + lvl('tyres')),
    accelMul: car.accel,
    boostMul: 1 + lvl('boost'),
  }
}
