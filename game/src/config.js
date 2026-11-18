// Vistamar — shared constants, seeded random and small math helpers.
// Every number here is the game's own tuning, written for this entry.
export const STEP = 1 / 60;
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 76;
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const BEACH_Y = 2260;
export const TAU = Math.PI * 2;

export const COLORS = {
  grass: '#7fae56',
  grassDark: '#74a24c',
  asphalt: '#3a3d42',
  asphaltLine: '#e8d44d',
  sidewalk: '#9a938a',
  sand: '#e6d29a',
  sea: '#2f7fb8',
  building: ['#b5654a', '#c98a4b', '#7d8aa0', '#a05a7d', '#5a8a6a', '#8a7d5a', '#6a6a8a', '#b04a4a'],
  roof: ['#5a3a2e', '#3e4a5a', '#4a5a3e', '#6a4a3e'],
  park: '#5da24a',
  tree: '#2f6b2f',
  garage: '#d8b13c',
  bank: '#3c7bd8',
  spray: '#c93c8a',
  hospital: '#e8e8e8',
};

/** Deterministic RNG (mulberry32) so a seed always rebuilds the same city. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng, a, b) { return a + rng() * (b - a); }
export function randInt(rng, a, b) { return Math.floor(rand(rng, a, b + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}
