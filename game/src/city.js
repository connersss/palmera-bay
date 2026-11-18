// Vistamar — the city itself: road grid, blocks, buildings, parks, beach and
// the named places the missions use. Everything is laid out from a seed.
import {
  WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y, BEACH_Y, COLORS,
  mulberry32, rand, randInt, pick,
} from './config.js';

export const PLACES = {
  garage: { x: 640, y: 560, label: "Mara's Garage", color: COLORS.garage },
  bank: { x: 1840, y: 960, label: 'Vistamar Bank', color: COLORS.bank },
  spray: { x: 1040, y: 1840, label: 'Pay & Spray', color: COLORS.spray },
  hospital: { x: 2240, y: 560, label: 'St. Anselm Hospital', color: COLORS.hospital },
  marina: { x: 2900, y: 2140, label: 'Marina', color: '#3c9ad8' },
  park: { x: 1600, y: 1200, label: 'Plaza Park', color: COLORS.park },
  taxiStand: { x: 1440, y: 2140, label: 'Taxi Stand', color: '#d8b13c' },
};

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  // Blocks sit between neighbouring roads; the outer rim is beach and sea.
  for (let ix = 0; ix < ROADS_X.length; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const x1 = (ix + 1 < ROADS_X.length ? ROADS_X[ix + 1] : WORLD_W - 40) - ROAD_W / 2 - 14;
      const y1 = (iy + 1 < ROADS_Y.length ? ROADS_Y[iy + 1] : BEACH_Y) - ROAD_W / 2 - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      // The middle block is the plaza park; one more block is a green.
      const isPark = (ix === 3 && iy === 2) || (ix === 5 && iy === 4);
      if (isPark) {
        parks.push({ x: x0, y: y0, w, h });
        const n = Math.floor((w * h) / 9000);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: rand(rng, x0 + 20, x1 - 20), y: rand(rng, y0 + 20, y1 - 20), r: rand(rng, 9, 15) });
        }
        continue;
      }
      const n = randInt(rng, 1, 3);
      for (let b = 0; b < n; b += 1) {
        const bw = rand(rng, 90, Math.min(220, w - 20));
        const bh = rand(rng, 80, Math.min(190, h - 20));
        const bx = rand(rng, x0, x1 - bw);
        const by = rand(rng, y0, y1 - bh);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: pick(rng, COLORS.building),
          roof: pick(rng, COLORS.roof),
          floors: randInt(rng, 1, 4),
        });
      }
      if (rng() < 0.6) {
        trees.push({ x: rand(rng, x0 + 16, x1 - 16), y: rand(rng, y0 + 16, y1 - 16), r: rand(rng, 8, 13) });
      }
    }
  }
  return { buildings, parks, trees, places: PLACES };
}

/** True when the point is on asphalt (inside a road's width). */
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

/** Snap a point to the nearest road centre line. */
export function nearestRoadPoint(x, y) {
  let bx = ROADS_X[0]; let bd = Math.abs(x - bx);
  for (const rx of ROADS_X) if (Math.abs(x - rx) < bd) { bd = Math.abs(x - rx); bx = rx; }
  let by = ROADS_Y[0]; bd = Math.abs(y - by);
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < bd) { bd = Math.abs(y - ry); by = ry; }
  return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y } : { x, y: by };
}

/** Nearest intersection to a point. */
export function nearestIntersection(x, y) {
  let bx = ROADS_X[0]; let bd = Math.abs(x - bx);
  for (const rx of ROADS_X) if (Math.abs(x - rx) < bd) { bd = Math.abs(x - rx); bx = rx; }
  let by = ROADS_Y[0]; bd = Math.abs(y - by);
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < bd) { bd = Math.abs(y - ry); by = ry; }
  return { x: bx, y: by };
}
