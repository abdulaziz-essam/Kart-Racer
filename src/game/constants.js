import { locate } from './path'

export const LAPS = 3
export const COUNTDOWN = 4.2 // seconds before GO

export const RACERS = [
  { name: 'You', paint: null, helmet: null, player: true },
  // Opponents drive cars from Kenney's Toy Car Kit (CC0)
  { name: 'Blaze', paint: '#e3261c', model: 'speedster', skill: 0.975 },
  { name: 'Sunny', paint: '#ffbf1a', model: 'racer-low', skill: 0.95 },
  { name: 'Moss', paint: '#1fae4b', model: 'racer', skill: 0.935 },
  { name: 'Violet', paint: '#8a35e0', model: 'vintage-racer', skill: 0.96 },
  { name: 'Tango', paint: '#ff6a00', model: 'drag-racer', skill: 0.925 },
]

export const KENNEY_MODELS = ['speedster', 'racer-low', 'racer', 'vintage-racer', 'drag-racer']
export const kenneyUrl = (m) => `/models/kenney/vehicle-${m}.glb`

// grid slot -> racer index (player starts 4th)
export const GRID_ORDER = [1, 4, 2, 0, 3, 5]

export const LINE_S = locate(217.6, 0, -1).dist // start/finish line under the gantry
