// Vistamar — pedestrians on the sidewalks, and the police: wanted level,
// foot cops who arrest, and interceptor cars that ram.
import {
  ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, BEACH_Y,
  rand, randInt, pick, clamp, angleTo, dist, angleDiff,
} from './config.js';
import { makeCar, separateCars } from './vehicles.js';
import { nearestRoadPoint, nearestIntersection, onRoad } from './city.js';

const PED_COLORS = ['#e8b13c', '#3c8ad8', '#d85a7d', '#5ad88a', '#8a5ad8', '#d8d8d8', '#e86a3c'];
const PED_SHIRTS = ['#c0392b', '#2e6db4', '#3d9970', '#8a5ad8', '#e8a13c', '#d8d8d8', '#5a7d8a'];

export function makePed(rng, x, y) {
  const p = nearestRoadPoint(x, y);
  return {
    x: p.x + rand(rng, -30, 30), y: p.y + rand(rng, -30, 30),
    angle: rand(rng, 0, Math.PI * 2), speed: rand(rng, 45, 80),
    color: pick(rng, PED_SHIRTS), skin: pick(rng, PED_COLORS),
    tx: p.x, ty: p.y, flee: 0, hail: false, fare: 0,
  };
}

/** Pick a new sidewalk stroll target near the pedestrian. */
function newStrollTarget(ped, rng) {
  const p = nearestRoadPoint(
    clamp(ped.x + rand(rng, -500, 500), 60, WORLD_W - 60),
    clamp(ped.y + rand(rng, -500, 500), 60, BEACH_Y - 40),
  );
  ped.tx = p.x + rand(rng, -26, 26);
  ped.ty = p.y + rand(rng, -26, 26);
}

export function stepPed(ped, player, rng, dt) {
  // Flee a fast car bearing down on them.
  const dPlayer = dist(ped.x, ped.y, player.x, player.y);
  if (player.inCar && Math.abs(player.carSpeed) > 160 && dPlayer < 150) ped.flee = 1.2;
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = angleTo(player.x, player.y, ped.x, ped.y);
    ped.x += Math.cos(away) * 170 * dt;
    ped.y += Math.sin(away) * 170 * dt;
    ped.angle = away;
  } else {
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 24) newStrollTarget(ped, rng);
    const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.angle = a;
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
  }
  ped.x = clamp(ped.x, 30, WORLD_W - 30);
  ped.y = clamp(ped.y, 30, BEACH_Y + 40);
}

/** Wanted stars from crime points; thresholds keep 1 star easy and 5 rare. */
export function starsFromPoints(points) {
  if (points >= 260) return 5;
  if (points >= 180) return 4;
  if (points >= 110) return 3;
  if (points >= 60) return 2;
  if (points >= 25) return 1;
  return 0;
}

export function makeCop(x, y, onFoot, rng) {
  return {
    x, y, angle: 0, speed: 0, onFoot,
    car: onFoot ? null : makeCar('police', x, y, 0, 'police', rng),
    grab: 0, ramCool: 0,
  };
}

/** Keep the right number of cops for the wanted level, spawning at the edges. */
export function balanceCops(state, rng) {
  const stars = state.wantedStars;
  const wantFoot = stars >= 1 ? Math.min(4, stars) : 0;
  const wantCars = stars >= 2 ? Math.min(3, stars - 1) : 0;
  const foot = state.cops.filter((c) => c.onFoot);
  const cars = state.cops.filter((c) => !c.onFoot);
  const spawnAt = () => {
    const edge = randInt(rng, 0, 3);
    const near = nearestIntersection(state.player.x, state.player.y);
    if (edge === 0) return { x: near.x + rand(rng, -500, 500), y: near.y - 420 };
    if (edge === 1) return { x: near.x + rand(rng, -500, 500), y: near.y + 420 };
    if (edge === 2) return { x: near.x - 420, y: near.y + rand(rng, -500, 500) };
    return { x: near.x + 420, y: near.y + rand(rng, -500, 500) };
  };
  while (foot.length < wantFoot) {
    const s = spawnAt();
    const cop = makeCop(clamp(s.x, 60, WORLD_W - 60), clamp(s.y, 60, WORLD_H - 60), true, rng);
    state.cops.push(cop); foot.push(cop);
  }
  while (cars.length < wantCars) {
    const s = spawnAt();
    const cop = makeCop(clamp(s.x, 60, WORLD_W - 60), clamp(s.y, 60, WORLD_H - 60), false, rng);
    cop.car.x = cop.x; cop.car.y = cop.y;
    state.cops.push(cop); cars.push(cop);
  }
  // Despawn far cops when the heat is off.
  state.cops = state.cops.filter((c) => {
    const keep = stars > 0 || dist(c.x, c.y, state.player.x, state.player.y) < 500;
    if (!keep && !c.onFoot) c.car.driver = null;
    return keep;
  });
}

/** One police step. Returns 'busted' when a foot cop holds the player. */
export function stepCop(cop, state, dt) {
  const p = state.player;
  if (cop.onFoot) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const a = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = a;
    const speed = p.inCar ? 235 : 205;
    cop.x += Math.cos(a) * speed * dt;
    cop.y += Math.sin(a) * speed * dt;
    if (!p.inCar && d < 30) {
      cop.grab += dt;
      if (cop.grab > 1.0) return 'busted';
    } else {
      cop.grab = Math.max(0, cop.grab - dt * 2);
    }
    return null;
  }
  // Interceptor: steer hard at the player and ram.
  const car = cop.car;
  const want = angleTo(car.x, car.y, p.x, p.y);
  car.angle += clamp(angleDiff(car.angle, want), -3.4 * dt, 3.4 * dt);
  const d = dist(car.x, car.y, p.x, p.y);
  const target = d > 260 ? car.def.top : car.def.top * 0.85;
  car.speed += clamp(target - car.speed, -600 * dt, 420 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.siren = (car.siren + dt) % 1;
  cop.x = car.x; cop.y = car.y;
  cop.ramCool -= dt;
  if (p.inCar && p.car) {
    const impact = separateCars(car, p.car);
    if (impact > 60 && cop.ramCool <= 0) {
      cop.ramCool = 1.0;
      return 'ram';
    }
  } else if (d < 34 && cop.ramCool <= 0) {
    cop.ramCool = 1.2;
    return 'ram';
  }
  return null;
}
