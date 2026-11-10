// Level features: optional add-ons a platformer level lists in `features: [...]`.
//
// A feature is a class constructed with the Platformer instance (`game`). Every hook is optional:
//
//   update(dt, prevY)      per-step logic after the core collisions
//   steerPlayer(dt, vx)    adjust the sheep's velocity before it moves (Sky Kingdom flight)
//   absorbHit() → bool     return true to cancel a hit (Neon shield)
//   onCheckpoint()         a checkpoint was reached
//   onStomp(enemy)         a ground enemy was stomped
//   updateCamera(dt) → bool  return true when the feature moved the camera itself (Infinite)
//   drawWorld(g)           draw in world space, before the sheep
//   drawGear(g)            draw on the sheep (gun, cape) in its local space
//   drawHud(g)             draw in screen space over the HUD
//   result() → object      extra fields for the end-of-level result
//   usesFire               true to show the FIRE button

import { Haunted } from './haunted.js';
import { Frost } from './frost.js';
import { Siege } from './siege.js';
import { Neon } from './neon.js';
import { Sky } from './sky.js';
import { Crystal } from './crystal.js';
import { Infinite } from './infinite.js';

export const FEATURES = {
  haunted: Haunted,
  frost: Frost,
  siege: Siege,
  neon: Neon,
  sky: Sky,
  crystal: Crystal,
  infinite: Infinite,
};
