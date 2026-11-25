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
- `src/Track.jsx`: loads the track and merges static meshes per material (about 250 objects become about 20 draw calls).
- `src/Scenery.jsx`: instanced trees, bushes, grass, flowers, tyre walls, flags, rocks and clouds.
- `src/Race.jsx`: grid, countdown, AI, laps, positions, chase camera and HUD.
- `src/game/`: path maths, kart physics, AI driver and the kart model builder (merges the kart into a few meshes, recolours each team).
- `src/materials.js`: glossy paint, chrome and world-space asphalt and grass detail (the Blender meshes have no UVs).

## Re-exporting from Blender

Re-export `kart.glb` with only the `Kart` collection selected and the `F1_Car` empty at the origin with no rotation.
Export `track.glb` with every other visible mesh selected.
If the road changes, regenerate `trackPath.json`: vertices 0-599 and 600-1199 of `Road` are its two edges.

## Credits

Opponent cars: [Toy Car Kit](https://kenney.nl/assets/toy-car-kit) by Kenney (www.kenney.nl), CC0.
The used models are in `public/models/kenney/`. The full downloaded pack is kept in `assets-src/` (git-ignored).
Each car uses the kit's white "variation B" palette and is tinted with its team colour in `src/game/kenneyModel.js`.
