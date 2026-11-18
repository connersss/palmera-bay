// Vistamar — the world: one state object, one fixed step. Player on foot and
// in cars, crimes and wanted level, fares, health, save, and the win/lose ends.
import {
  STEP, WORLD_W, WORLD_H, BEACH_Y, ROADS_X, ROADS_Y,
  mulberry32, rand, randInt, pick, clamp, dist, angleTo, angleDiff, circleHitsRect,
} from './config.js';
import { buildCity, nearestRoadPoint, PLACES } from './city.js';
import {
  CAR_TYPES, makeCar, driveCar, collideBuildings, spawnTrafficCar, separateCars, stepTraffic,
} from './vehicles.js';
import { makePed, stepPed, starsFromPoints, balanceCops, stepCop } from './pedestrians.js';
import {
  MISSIONS, missionState, currentMission, missionTarget, updateMission,
} from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION = 4;

const SAVE_KEY = 'vistamar-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 0, missionsDone: 0, best: 0 };
    const s = JSON.parse(raw);
    return { cash: s.cash || 0, missionsDone: s.missionsDone || 0, best: s.best || 0 };
  } catch {
    return { cash: 0, missionsDone: 0, best: 0 };
  }
}

export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* no storage */ }
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const city = buildCity(seed);
  const save = loadSave();
  const state = {
    seed, rng, city, time: 0,
    player: {
      x: 640, y: 640, angle: 0, speed: 0, onFoot: true, inCar: false, car: null,
      carSpeed: 0, health: 100, cash: save.cash, weapon: 'fists', ammo: 24,
      lastCrime: -99, punchCool: 0, shotCool: 0,
    },
    cars: [], peds: [], cops: [],
    crime: 0, wantedStars: 0,
    mission: missionState(Math.min(save.missionsDone, MISSIONS.length - 1)),
    missionsDone: save.missionsDone,
    banner: 'Welcome to Vistamar', bannerT: 3,
    over: null, fare: null, fareEarned: 0, sprayCool: 0, stats: { stolen: 0, fares: 0 },
    shot: null,
  };
  // Parked cars around the city, plus traffic and pedestrians.
  const parkedTypes = ['sedan', 'hatch', 'sedan', 'taxi', 'van', 'sports', 'hatch', 'sedan'];
  for (let i = 0; i < 14; i += 1) {
    const axis = rng() < 0.5 ? 'v' : 'h';
    const roads = axis === 'v' ? ROADS_X : ROADS_Y;
    const road = randInt(rng, 0, roads.length - 1);
    const along = rand(rng, 200, (axis === 'v' ? WORLD_H : WORLD_W) - 200);
    const car = makeCar(pick(rng, parkedTypes), 0, 0, 0, null, rng);
    if (axis === 'v') {
      car.x = roads[road] + (rng() < 0.5 ? -19 : 19);
      car.y = along;
      car.angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.y = roads[road] + (rng() < 0.5 ? -19 : 19);
      car.x = along;
      car.angle = rng() < 0.5 ? 0 : Math.PI;
    }
    state.cars.push(car);
  }
  for (let i = 0; i < 12; i += 1) state.cars.push(spawnTrafficCar(rng, ['sedan', 'hatch', 'van', 'taxi']));
  for (let i = 0; i < 26; i += 1) {
    state.peds.push(makePed(rng, rand(rng, 200, 3000), rand(rng, 200, 2100)));
  }
  // A sports car waits near the garage for the cover shot and for fun.
  const gt = makeCar('sports', 700, 700, Math.PI / 2, null, rng);
  state.cars.push(gt);
  return state;
}

export function resetWorld(state, seed) {
  const fresh = createWorld(seed);
  for (const k of Object.keys(fresh)) state[k] = fresh[k];
}

/** Nearest car the player could get into. */
function nearestCar(state, maxD) {
  let best = null; let bd = maxD;
  for (const car of state.cars) {
    if (car.driver === 'police') continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function addCrime(state, points) {
  state.crime += points;
  state.player.lastCrime = state.time;
}

export function stepWorld(state, input, dt) {
  const p = state.player;
  const rng = state.rng;
  state.time += dt;
  let events = EVENT_NONE;

  // --- player on foot ---
  if (!p.inCar) {
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    const speed = 240;
    p.speed = (mx || my) ? speed : 0;
    if (mx || my) p.angle = Math.atan2(my, mx);
    const nx = p.x + (mx / len) * p.speed * dt;
    const ny = p.y + (my / len) * p.speed * dt;
    let blocked = false;
    for (const b of state.city.buildings) {
      if (circleHitsRect(nx, ny, 14, b.x, b.y, b.w, b.h)) { blocked = true; break; }
    }
    if (!blocked) {
      p.x = clamp(nx, 30, WORLD_W - 30);
      p.y = clamp(ny, 30, BEACH_Y + 40);
    }
    p.carSpeed = 0;
  } else if (p.car) {
    driveCar(p.car, input, dt);
    const impact = collideBuildings(p.car, state.city.buildings);
    if (impact > 200) {
      p.health -= Math.min(18, (impact - 200) / 22);
    }
    p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
    p.carSpeed = p.car.speed;
    p.speed = Math.abs(p.car.speed);
  }

  // --- enter / exit car ---
  if (input.action) {
    input.action = false;
    if (!p.inCar) {
      const car = nearestCar(state, 78);
      if (car) {
        p.inCar = true; p.car = car; car.driver = 'player';
        state.stats.stolen += 1;
        if (state.time - p.lastCrime > 2) addCrime(state, 25);
        state.banner = `Stole a ${car.def.name}`;
        state.bannerT = 2;
      }
    } else if (p.car) {
      const car = p.car;
      car.driver = null;
      p.inCar = false; p.car = null;
      const side = p.angle + Math.PI / 2;
      p.x = clamp(car.x + Math.cos(side) * 40, 30, WORLD_W - 30);
      p.y = clamp(car.y + Math.sin(side) * 40, 30, BEACH_Y + 40);
    }
  }

  // --- combat: punch on foot, pistol with 2 ---
  p.punchCool -= dt; p.shotCool -= dt;
  if (input.attack) {
    input.attack = false;
    if (p.weapon === 'pistol' && p.ammo > 0 && p.shotCool <= 0) {
      p.ammo -= 1; p.shotCool = 0.28;
      state.shot = { x: p.x, y: p.y, angle: p.angle, t: 0.08 };
      let best = null; let bd = 340;
      for (const cop of state.cops) {
        const d = dist(p.x, p.y, cop.x, cop.y);
        const a = Math.abs(angleDiff(p.angle, angleTo(p.x, p.y, cop.x, cop.y)));
        if (d < bd && a < 0.5) { bd = d; best = cop; }
      }
      if (best) {
        best.x += Math.cos(p.angle) * 30;
        best.y += Math.sin(p.angle) * 30;
        addCrime(state, 45);
        state.banner = 'You shot a cop!';
        state.bannerT = 2;
      }
    } else if (p.punchCool <= 0) {
      p.punchCool = 0.45;
      for (const ped of state.peds) {
        if (dist(p.x, p.y, ped.x, ped.y) < 46) {
          ped.flee = 2;
          ped.x += Math.cos(p.angle) * 40;
          ped.y += Math.sin(p.angle) * 40;
          addCrime(state, 30);
        }
      }
      for (const cop of state.cops) {
        if (cop.onFoot && dist(p.x, p.y, cop.x, cop.y) < 46) {
          cop.x += Math.cos(p.angle) * 50;
          cop.y += Math.sin(p.angle) * 50;
          addCrime(state, 40);
        }
      }
    }
  }
  if (input.weapon) {
    input.weapon = false;
    p.weapon = p.weapon === 'fists' ? 'pistol' : 'fists';
    state.banner = p.weapon === 'pistol' ? `Pistol out (${p.ammo} rounds)` : 'Fists out';
    state.bannerT = 1.5;
  }

  // --- traffic ---
  for (const car of state.cars) {
    if (car.driver === 'traffic') stepTraffic(car, state.cars, rng, dt);
  }
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i]; const b = state.cars[j];
      if (a.driver === 'police' || b.driver === 'police') continue;
      const impact = separateCars(a, b);
      if (impact > 240 && (a.driver === 'player' || b.driver === 'player')) {
        p.health -= Math.min(10, (impact - 240) / 30);
      }
    }
  }
  // Player car hitting pedestrians.
  if (p.inCar && Math.abs(p.carSpeed) > 120) {
    for (const ped of state.peds) {
      if (dist(p.x, p.y, ped.x, ped.y) < 30) {
        ped.flee = 2;
        ped.x += Math.cos(p.angle) * 60;
        ped.y += Math.sin(p.angle) * 60;
        addCrime(state, 30);
        p.health -= 1;
      }
    }
  }
  for (const ped of state.peds) stepPed(ped, p, rng, dt);

  // --- taxi fares: a waving pedestrian pays when you drive them to a marker ---
  if (p.inCar && p.car && p.car.type === 'taxi') {
    if (!state.fare) {
      for (const ped of state.peds) {
        if (!ped.hail && dist(p.x, p.y, ped.x, ped.y) < 70 && Math.abs(p.carSpeed) < 60) {
          ped.hail = true;
          const t = nearestRoadPoint(p.x + rand(rng, -900, 900), p.y + rand(rng, -700, 700));
          state.fare = { x: t.x, y: t.y, ped, amount: randInt(rng, 40, 80) };
          state.banner = `Fare! Take them to the marker ($${state.fare.amount})`;
          state.bannerT = 2.5;
          break;
        }
      }
    } else if (dist(p.x, p.y, state.fare.x, state.fare.y) < 80) {
      const amount = state.fare.amount;
      p.cash += amount;
      state.fareEarned += amount;
      state.mission.earned += amount;
      state.stats.fares += 1;
      state.fare.ped.hail = false;
      state.fare = null;
      state.banner = `Fare paid +$${amount}`;
      state.bannerT = 2;
    }
  } else if (state.fare && !(p.car && p.car.type === 'taxi')) {
    state.fare.ped.hail = false;
    state.fare = null;
  }

  // --- pay & spray: drive in, pay $150, lose the heat ---
  state.sprayCool -= dt;
  if (p.inCar && dist(p.x, p.y, PLACES.spray.x, PLACES.spray.y) < 90 && state.sprayCool <= 0) {
    if (state.wantedStars > 0 && p.cash >= 150) {
      p.cash -= 150;
      state.crime = 0;
      state.sprayCool = 8;
      state.banner = 'Pay & Spray — clean!';
      state.bannerT = 2.5;
    }
  }
  // Ammo top-up at the garage.
  if (dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 100) {
    p.ammo = Math.max(p.ammo, 24);
  }

  // --- wanted level, cops ---
  if (state.time - p.lastCrime > 6 && state.crime > 0) {
    state.crime = Math.max(0, state.crime - 2.2 * dt);
  }
  state.wantedStars = starsFromPoints(state.crime);
  balanceCops(state, rng);
  for (const cop of state.cops) {
    const result = stepCop(cop, state, dt);
    if (result === 'busted') {
      state.over = 'busted';
      events |= EVENT_BUSTED;
    } else if (result === 'ram') {
      p.health -= 9;
      state.banner = 'VCPD rammed you!';
      state.bannerT = 1.5;
    }
  }

  // --- mission ---
  const missionResult = updateMission(state, dt);
  if (missionResult === 'done') events |= EVENT_MISSION;
  if (missionResult === 'failed') {
    state.mission = missionState(state.mission.index);
    state.banner = 'Job failed — Mara gives you another shot';
    state.bannerT = 3;
  }

  // --- health, ends, save ---
  if (!p.inCar && state.wantedStars === 0) p.health = Math.min(100, p.health + 3 * dt);
  if (state.shot) {
    state.shot.t -= dt;
    if (state.shot.t <= 0) state.shot = null;
  }
  state.bannerT -= dt;
  if (p.health <= 0 && !state.over) {
    state.over = 'wasted';
    events |= EVENT_WASTED;
  }
  if (state.over) {
    const save = loadSave();
    save.cash = p.cash;
    save.missionsDone = Math.max(save.missionsDone, state.missionsDone);
    save.best = Math.max(save.best, p.cash);
    storeSave(save);
  }
  return events;
}
