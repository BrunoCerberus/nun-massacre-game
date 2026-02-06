# NUN MASSACRE

A PS1-style survival horror game built with Three.js. Navigate a dark convent, find three keys, and escape before the nun catches you.

## Play

```bash
# Any local HTTP server works
npx serve .
# or
python3 -m http.server 8080
```

Open http://localhost:8080 in a modern browser (Chrome, Firefox, Safari).

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look |
| Shift | Sprint |
| E | Interact (doors, items) |
| Space | Hide (near hiding spots) |
| F | Flashlight |

## Objective

Find all 3 colored keys (Red, Blue, Green) scattered across the convent and unlock the cellar exit to escape. The nun patrols the halls - avoid her line of sight, hide when needed, and manage your stamina.

## Features

- First-person PS1-style rendering (320x240 upscaled with nearest-neighbor)
- 13 rooms: entry hall, 4 corridors, classrooms, library, kitchen, chapel, dining hall, storage, cellar
- Procedural textures (brick walls, tile floors, wood doors) - zero external assets
- Enemy AI with patrol, chase, and search states
- 6 hiding spots (lockers, cabinets, confessional)
- Sprint + stamina system
- Flashlight with battery drain
- Procedural audio via Web Audio API (ambient drone, footsteps, chase music)
- CRT scanlines, vignette, and fear overlay
- Real-time minimap
- Lore notes to discover

## Tech Stack

- [Three.js](https://threejs.org/) r160 (loaded via CDN importmap)
- Vanilla JavaScript (ES modules)
- Web Audio API for procedural sound
- No build step, no dependencies to install

## Project Structure

```
nun-massacre-game/
├── index.html      # HTML, CSS, UI overlays, importmap
└── js/
    └── main.js     # Complete game logic (~1600 lines)
```

## License

MIT
