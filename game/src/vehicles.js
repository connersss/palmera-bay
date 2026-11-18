// Vistamar — cars: the types you can steal and drive, arcade driving physics,
// and the traffic that fills the roads.
import {
  ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, BEACH_Y,
  rand, randInt, pick, clamp, angleDiff, circleHitsRect,
} from './config.js';

export const CAR_TYPES = {
  sedan: { name: 'Vistamar Sedan', top: 330, accel: 260, brake: 520, turn: 2.7, len: 52, wid: 26, colors: ['#c0392b', '#2e6db4', '#7d7d7d', '#3d9970'] },
  hatch: { name: 'Pinto Hatch', top: 290, accel: 240, brake: 500, turn: 2.9, len: 44, wid: 24, colors: ['#e8a13c', '#8a6d3b', '#4a7d8a'] },
  taxi: { name: 'City Taxi', top: 320, accel: 250, brake: 520, turn: 2.8, len: 50, wid: 26, colors: ['#e8c13c'] },
  van: { name: 'Work Van', top: 260, accel: 190, brake: 430, turn: 2.3, len: 58, wid: 28, colors: ['#d8d8d8', '#5a7d8a'] },
  sports: { name: 'Comet GT', top: 540, accel: 420, brake: 620, turn: 3.1, len: 50, wid: 25, colors: ['#d81e5b', '#1e88d8', '#f0f0f0'] },
  truck: { name: 'Flatbed', top: 230, accel: 160, brake: 380, turn: 2.0, len: 66, wid: 28, colors: ['#6a4a2e', '#3e5a6a'] },
  police: { name: 'VCPD Interceptor', top: 460, accel: 380, brake: 600, turn: 3.0, len: 52, wid: 26, colors: ['#1e2a3a'] },
};

export function makeCar(type, x, y, angle, driver, rng) {
  const def = CAR_TYPES[type];
  const pickRng = rng || Math.random;
  return {
    type, def, x, y, angle, speed: 0,
    color: pick(pickRng, def.colors),
    driver: driver || null, // 'player' | 'traffic' | 'police' | null (parked)
    health: 100, brakeLight: false, siren: 0,
    // traffic state
    axis: 'v', road: 0, dir: 1, cruise: 0, wait: 0,
  };
}

/** Arcade driving: throttle, brake and steering against the car's own stats. */
export function driveCar(car, input, dt) {
  const def = car.def;
  if (input.up) car.speed += def.accel * dt;
  if (input.down) {
    if (car.speed > 10) car.speed -= def.brake * dt;
    else car.speed -= def.accel * 0.55 * dt;
  }
  if (!input.up && !input.down) car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -140, def.top);
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const grip = clamp(Math.abs(car.speed) / def.top, 0, 1);
  car.angle += steer * def.turn * grip * (car.speed >= 0 ? 1 : -1) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = !!input.down;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, BEACH_Y + 60);
}

/** Push a car out of buildings; returns impact speed (0 when no hit). */
export function collideBuildings(car, buildings) {
  const r = car.def.len * 0.42;
  let impact = 0;
  for (const b of buildings) {
    if (circleHitsRect(car.x, car.y, r, b.x, b.y, b.w, b.h)) {
      const nx = clamp(car.x, b.x, b.x + b.w);
      const ny = clamp(car.y, b.y, b.y + b.h);
      const dx = car.x - nx; const dy = car.y - ny;
      const d = Math.hypot(dx, dy) || 1;
      const push = r - d + 1;
      car.x += (dx / d) * push;
      car.y += (dy / d) * push;
      impact = Math.max(impact, Math.abs(car.speed));
      car.speed *= 0.45;
    }
  }
  return impact;
}

/** Right-hand lane offset for a car travelling along a road. */
function laneOffset(axis, dir) {
  // Heading south (+y) keeps right on the west side; heading east (+x) on the south side.
  if (axis === 'v') return dir > 0 ? -19 : 19;
  return dir > 0 ? 19 : -19;
}

/** Spawn a traffic car on a random road, already moving with the flow. */
export function spawnTrafficCar(rng, types) {
  const axis = rng() < 0.5 ? 'v' : 'h';
  const roads = axis === 'v' ? ROADS_X : ROADS_Y;
  const road = randInt(rng, 0, roads.length - 1);
  const dir = rng() < 0.5 ? -1 : 1;
  const along = rand(rng, 120, (axis === 'v' ? WORLD_H : WORLD_W) - 120);
  const type = pick(rng, types);
  const car = makeCar(type, 0, 0, 0, 'traffic', rng);
  car.axis = axis; car.road = road; car.dir = dir;
  car.cruise = rand(rng, 120, 210);
  car.speed = car.cruise;
  if (axis === 'v') {
    car.x = roads[road] + laneOffset('v', dir);
    car.y = along;
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y = roads[road] + laneOffset('h', dir);
    car.x = along;
    car.angle = dir > 0 ? 0 : Math.PI;
  }
  return car;
}

function carAhead(car, cars) {
  const fx = Math.cos(car.angle); const fy = Math.sin(car.angle);
  let best = Infinity;
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x; const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < 110 && side < 30 && along < best) best = along;
  }
  return best;
}

/** One traffic step: follow the road, slow behind others, turn at junctions. */
export function stepTraffic(car, cars, rng, dt) {
  const roads = car.axis === 'v' ? ROADS_X : ROADS_Y;
  const ahead = carAhead(car, cars);
  const want = ahead < 70 ? Math.max(0, car.cruise * (ahead / 90)) : car.cruise;
  car.speed += clamp(want - car.speed, -420 * dt, 240 * dt);
  const step = car.speed * dt;
  if (car.axis === 'v') {
    car.y += car.dir * step;
    car.x += (roads[car.road] + laneOffset('v', car.dir) - car.x) * Math.min(1, 6 * dt);
    car.angle += angleDiff(car.angle, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) * Math.min(1, 8 * dt);
  } else {
    car.x += car.dir * step;
    car.y += (roads[car.road] + laneOffset('h', car.dir) - car.y) * Math.min(1, 6 * dt);
    car.angle += angleDiff(car.angle, car.dir > 0 ? 0 : Math.PI) * Math.min(1, 8 * dt);
  }
  // At a crossroads, sometimes turn onto the other road.
  const cross = car.axis === 'v' ? ROADS_Y : ROADS_X;
  const along = car.axis === 'v' ? car.y : car.x;
  for (let i = 0; i < cross.length; i += 1) {
    if (Math.abs(along - cross[i]) < 14 && rng() < 0.012) {
      car.axis = car.axis === 'v' ? 'h' : 'v';
      car.road = i;
      car.dir = rng() < 0.5 ? -1 : 1;
      break;
    }
  }
  // Wrap around the city edge instead of piling up.
  if (car.axis === 'v' && (car.y < 40 || car.y > WORLD_H - 40)) car.y = car.y < 40 ? WORLD_H - 60 : 60;
  if (car.axis === 'h' && (car.x < 40 || car.x > WORLD_W - 40)) car.x = car.x < 40 ? WORLD_W - 60 : 60;
}

/** Gentle circle separation between two cars; returns the impact speed. */
export function separateCars(a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = (a.def.len + b.def.len) * 0.38;
  if (d === 0 || d >= min) return 0;
  const push = (min - d) / 2;
  const nx = dx / d; const ny = dy / d;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.9; b.speed = avg * 0.9;
  return impact;
}
