# AGENTS.md

## Game AI Agents

### The Nun (`NunEnemy` class)

The primary antagonist. A geometric figure with a black robe, white wimple, and glowing red eyes that patrols the convent.

#### State Machine

| State | Behavior | Speed | Transition To |
|-------|----------|-------|---------------|
| **patrol** | Follows waypoint loop through all rooms | `nunPatrolSpd` (2.0) | chase (on sight), search (on hearing) |
| **chase** | Moves directly toward player position | `nunChaseSpd` (5.8) | search (player hides or breaks LOS) |
| **search** | Goes to last known player position, looks around | patrol speed x1.3 | chase (on sight), patrol (after `nunSearchTime`) |

#### Detection

- **Visual**: Cone-based LOS check. Range = `nunSightRange` (14 units), angle = `nunSightAngle` (0.7 rad / ~40 degrees from facing direction). Blocked when player is hiding.
- **Auditory**: Hears sprinting within `nunHearDist` (8 units). Triggers search state toward the sound source.
- **Catch**: Player dies when within `nunCatchDist` (1.4 units) and not hiding.

#### Patrol Route

A fixed waypoint loop covering the full map:

```
Chapel -> S.Corridor -> Entry -> N.Corridor -> Classroom B ->
N.Corridor -> Classroom A -> N.Corridor -> Entry -> E.Corridor ->
Library -> E.Corridor -> Kitchen -> E.Corridor -> Entry ->
W.Corridor -> Storage -> W.Corridor -> Entry -> S.Corridor ->
Dining -> S.Corridor -> (repeat)
```

#### Movement

- Uses simple direct movement toward target position
- Grid-based walkability check prevents moving through walls
- Faces movement direction automatically
- Vertical bobbing animation (faster during chase)

### Player Agent (implicit)

The player is not an AI agent but has systems that interact with AI:

- **Sprinting** generates noise detectable by the nun
- **Hiding** makes the player invisible to nun's visual detection
- **Flashlight** does not affect nun detection (visual only for player benefit)

## Tuning

All agent parameters are in the `CFG` object at the top of `js/main.js`. Key values:

```javascript
nunPatrolSpd: 2.0,    // Patrol movement speed
nunChaseSpd: 5.8,     // Chase movement speed
nunSightRange: 14,    // Visual detection range (world units)
nunSightAngle: 0.7,   // Detection cone half-angle (radians)
nunCatchDist: 1.4,    // Kill distance
nunHearDist: 8,       // Sprint hearing range
nunSearchTime: 8,     // Seconds to search before resuming patrol
```
