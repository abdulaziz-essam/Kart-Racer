import sunnyMeadow from '../tracks/sunny-meadow.json'
import lakesideLoop from '../tracks/lakeside-loop.json'
import twistyHills from '../tracks/twisty-hills.json'
import canyonSprint from '../tracks/canyon-sprint.json'

// Four-race Grand Prix. Track files come from blender/make_tracks.py.
export const TRACKS = [sunnyMeadow, lakesideLoop, twistyHills, canyonSprint]

// Points for 1st..6th in each race; most points after the last race wins the cup
export const POINTS_TABLE = [10, 8, 6, 4, 2, 1]

/** Final order of a race: finishers by time, then everyone else by distance covered. */
export function raceOrder(field) {
  return [...field].sort((a, b) => {
    if (a.st.finished && b.st.finished) return a.st.finishTime - b.st.finishTime
    if (a.st.finished !== b.st.finished) return a.st.finished ? -1 : 1
    return b.st.progress - a.st.progress
  })
}

/** Add one race's result to the season table. result: [{ name, ... }] in finishing order. */
export function addRace(standings, result) {
  const next = { ...standings }
  result.forEach((r, i) => { next[r.name] = (next[r.name] || 0) + POINTS_TABLE[i] })
  return next
}

/** Season table sorted by points (ties: better result in the latest race). */
export function sortedStandings(standings, racers, lastResult = []) {
  const lastPos = (n) => { const i = lastResult.findIndex((r) => r.name === n); return i < 0 ? 99 : i }
  return racers
    .map((r) => ({ ...r, points: standings[r.name] || 0 }))
    .sort((a, b) => b.points - a.points || lastPos(a.name) - lastPos(b.name))
}
