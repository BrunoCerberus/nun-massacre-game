# CLAUDE.md

## Project Overview

PS1-style survival horror game built with Three.js. Single-page web app with no build step.

## Architecture

- `index.html` - Entry point with HTML structure, CSS styling, UI overlays, and Three.js importmap
- `js/main.js` - All game logic in one file, organized into sections:
  - **Config** (`CFG` object) - All tunable constants
  - **Map Generation** (`generateMap()`) - 50x50 grid-based level using `carve()` calls
  - **Coordinate Helpers** - `gridToWorld()`, `worldToGrid()`, `isWalkable()`
  - **Procedural Textures** - Canvas-based texture generation (walls, floors, doors)
  - **LevelBuilder class** - Generates merged Three.js geometry from the grid map, places doors/items/furniture/lights
  - **NunEnemy class** - Enemy AI with patrol/chase/search state machine
  - **AudioManager class** - Web Audio API procedural sound (no audio files)
  - **Game class** - Main game loop, player controller, input, UI updates, state management

## Key Conventions

- The level is a 2D grid (`MAP_W x MAP_H`). Each cell = `CFG.cell` world units (2.0). `0` = wall, `1` = floor.
- Wall faces are generated only where a floor cell borders a wall cell.
- All geometry is merged into three large meshes (walls, floors, ceilings) for performance.
- Collision detection uses the grid: check `isWalkable()` before moving.
- The renderer is set to 320x240 with CSS stretching for the PS1 pixelation effect.
- Three.js is loaded from CDN via importmap - no npm/node_modules.

## Running Locally

Requires a local HTTP server (ES modules need it):
```bash
python3 -m http.server 8080
```

## Common Tasks

- **Adjust difficulty**: Modify `CFG` values (nun speed, sight range, stamina)
- **Add rooms**: Add `carve()` calls in `generateMap()` and a room entry in `ROOM_DEFS`
- **Add items**: Add entries to `itemDefs` array in `LevelBuilder.placeItems()`
- **Change lighting**: Modify `lightPositions` array in `LevelBuilder.addLights()`
- **Modify nun patrol**: Edit `this.waypoints` array in `NunEnemy` constructor
