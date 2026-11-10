// Builders that turn compact level-data arrays (see levels.js) into the objects the platformer uses.

/** Ground surfaces sit at y = 380; anything above is a thin board. */
export const GROUND_Y = 380;

export function makePlatform([x, y, w, type = 's', moveX = 0, moveY = 0, speed = 0, baseY = y]) {
  const ground = y >= GROUND_Y;
  return {
    x, y, w, h: ground ? 70 : 16, ground, type, moveX, moveY, speed, baseY,
    originX: x, dx: 0, dy: 0, crumbleTimer: 0, fallen: false, respawnTimer: 0,
  };
}

/** A ground enemy patrolling between min and max (wolf, snowman, soldier — the theme decides the look). */
export const makeWolf = ([x, y, min, max, speed]) => ({ x, y, min, max, speed, dir: 1, dead: false });
