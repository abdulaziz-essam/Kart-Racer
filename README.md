# Kart Rally

A 3-lap kart race against 5 AI drivers, built with React, three.js and react-three-fiber.
The kart and the track come from the Blender project `blender/f1_world.blend`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 (or the port Vite prints).

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Accelerate |
| S / ↓ | Brake / reverse |
| A D / ← → | Steer |
| Hold Space | Drift. Release after ~1 s for a speed boost |
| R | Respawn on the track |

## How it fits together

- `public/models/kart.glb`, `track.glb`: exported from Blender (glTF, Y-up).
- `src/trackPath.json`: racing line (centre of the road ribbon) taken from `track.glb`.
- `src/Track.jsx`: loads the Blender props, scales the layout 1.4x (`WORLD_SCALE` in `game/path.js`) and merges static meshes per material.
- `src/TrackSurface.jsx`: the 18 m road, painted lines, kerbs, grass verges and start grid, generated from the racing line (no walls).
- `src/Terrain.jsx` + `src/game/terrain.js`: sculpted landscape (flat by the track, banks, rolling hills); `heightAt()` places scenery on it.
- `src/Props.jsx`: inflatable arches, chevron corner boards, tents, barrels, hay bales.
- `src/Scenery.jsx`: instanced trees, bushes, grass, flowers, tyre walls, flags, rocks and clouds.
- `src/Race.jsx`: grid, countdown, AI, laps, positions, chase camera and HUD.
- `src/game/`: path maths, kart physics, AI driver and the kart model builder (merges the kart into a few meshes, recolours each team).
- `src/materials.js`: glossy paint, chrome and world-space asphalt and grass detail (the Blender meshes have no UVs).

## Re-exporting from Blender

Re-export `kart.glb` with only the `Kart` collection selected and the `F1_Car` empty at the origin with no rotation.
Export `track.glb` with every other visible mesh selected.
If the road changes, regenerate `trackPath.json`: vertices 0-599 and 600-1199 of `Road` are its two edges.

## Grand Prix

Four races, 3 laps each. Points per place: 10, 8, 6, 4, 2, 1. Most points after race 4 wins the cup.

Screens (hand-drawn with rough.js): title, how to win, race card, results and championship, champion podium.
Dev shortcut: `http://localhost:5179/?race=3` opens the card for race 3.

### Tracks

The four tracks (Sunny Meadow, Lakeside Loop, Twisty Hills, Canyon Sprint) are built in Blender by `blender/make_tracks.py`.
Re-run it after editing the track shapes:

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python blender/make_tracks.py -- .
```

That writes `blender/grand_prix_tracks.blend` (preview) and `src/tracks/<id>.json`.
Each JSON is only the racing line (4-7 KB), and the browser generates the road, kerbs, terrain, start area and props from it.
Each track's theme (colours, hills, lake, trees) is in `src/game/themes.js`.

## Credits

Opponent cars: [Toy Car Kit](https://kenney.nl/assets/toy-car-kit) by Kenney (www.kenney.nl), CC0.
The used models are in `public/models/kenney/`. The full downloaded pack is kept in `assets-src/` (git-ignored).
Each car uses the kit's white "variation B" palette and is tinted with its team colour in `src/game/kenneyModel.js`.

Drivers (ready, not yet placed in the karts): [Mini Characters](https://kenney.nl/assets/mini-characters) by Kenney, CC0, in `public/models/drivers/` (they include a `drive` animation).
