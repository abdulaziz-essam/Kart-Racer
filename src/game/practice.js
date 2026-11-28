// The Test Track behind the paddock: a small stadium loop (two 120 m straights,
// two 32 m hairpins) for trying out cars and upgrades. Same format as the
// Grand Prix track files, so the normal track/race code drives it.

const STRAIGHT = 120, RADIUS = 32, STEP = 5

function stadium() {
  const pts = []
  const push = (x, z) => pts.push([+x.toFixed(2), +z.toFixed(2)])
  // start halfway down the bottom straight, heading +x (anticlockwise seen from above)
  for (let x = 0; x < STRAIGHT / 2; x += STEP) push(x, RADIUS)
  for (let a = 0; a < Math.PI; a += STEP / RADIUS) push(STRAIGHT / 2 + Math.sin(a) * RADIUS, Math.cos(a) * RADIUS)
  for (let x = STRAIGHT / 2; x > -STRAIGHT / 2; x -= STEP) push(x, -RADIUS)
  for (let a = 0; a < Math.PI; a += STEP / RADIUS) push(-STRAIGHT / 2 - Math.sin(a) * RADIUS, -Math.cos(a) * RADIUS)
  for (let x = -STRAIGHT / 2; x < 0; x += STEP) push(x, RADIUS)
  return pts
}

export const PRACTICE_TRACK = {
  id: 'test-track', name: 'Test Track', theme: 'meadow', width: 13,
  length: Math.round(2 * STRAIGHT + 2 * Math.PI * RADIUS), startS: 0,
  points: stadium(),
}
