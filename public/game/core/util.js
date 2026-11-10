// Small math helpers shared by every module.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Positive modulo: wrap(-1, 10) === 9. Used for scrolling/looping backgrounds. */
export const wrap = (v, m) => ((v % m) + m) % m;

/** Frame-rate independent "move toward" factor for exponential smoothing. */
export const approach = (rate, dt) => Math.min(1, rate * dt);

/** Axis-aligned overlap test on one axis. */
export const overlaps = (a0, a1, b0, b1) => a1 > b0 && a0 < b1;

/**
 * Park–Miller "minimal standard" PRNG (the same generator the original space level used),
 * so seeded layouts come out identical every run.
 */
export function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
