// Vistamar — the story: six jobs for Mara Voss, each a short chain of stages.
// A stage is one verb: get in a car, reach a place, wait there, earn fares,
// shake the cops, or hold up the bank. Rewards are cash, the game's progress.
import { PLACES } from './city.js';
import { dist } from './config.js';

export const MISSIONS = [
  {
    id: 'wheels', name: 'First Wheels', reward: 200,
    brief: "Mara needs a driver. Steal any car and bring it to her garage.",
    stages: [
      { type: 'car', text: 'Steal a car (walk up to one, press E)' },
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, r: 100, text: "Drive to Mara's Garage" },
    ],
  },
  {
    id: 'getaway', name: 'Getaway Driver', reward: 400,
    brief: 'Pick Mara up at Plaza Park and get her to the Marina. The clock is running.',
    stages: [
      { type: 'goto', x: PLACES.park.x, y: PLACES.park.y, r: 110, text: 'Pick Mara up at Plaza Park', time: 75 },
      { type: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, r: 120, text: 'Get Mara to the Marina', time: 60 },
    ],
  },
  {
    id: 'taxi', name: 'Taxi Nights', reward: 350,
    brief: 'Borrow a taxi and earn fares. Pedestrians waving you down pay cash.',
    stages: [
      { type: 'taxi', text: 'Get a taxi (yellow cab, press E)' },
      { type: 'earn', amount: 300, text: 'Earn $300 in taxi fares' },
    ],
  },
  {
    id: 'packages', name: 'Package Run', reward: 600,
    brief: 'Three drops, no questions. The cops will not like the last one.',
    stages: [
      { type: 'goto', x: 1040, y: 640, r: 90, text: 'Drop 1: Corner of 2nd & Vine' },
      { type: 'goto', x: 2240, y: 1440, r: 90, text: 'Drop 2: Southside docks' },
      { type: 'goto', x: 640, y: 1840, r: 90, text: 'Drop 3: The old laundry', heat: 40 },
    ],
  },
  {
    id: 'heat', name: 'Lose the Heat', reward: 800,
    brief: 'Make some noise, then vanish. Reach 3 stars, then get clean.',
    stages: [
      { type: 'heat', stars: 3, text: 'Raise your wanted level to 3 stars' },
      { type: 'clean', text: 'Lose the cops — get back to 0 stars' },
    ],
  },
  {
    id: 'score', name: 'The Big Score', reward: 1500,
    brief: 'Hold up Vistamar Bank, then lose a 4-star tail and reach the garage.',
    stages: [
      { type: 'goto', x: PLACES.bank.x, y: PLACES.bank.y, r: 100, text: 'Reach Vistamar Bank' },
      { type: 'rob', seconds: 5, text: 'Hold position — cracking the vault (stay put)' },
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, r: 100, text: "Escape to Mara's Garage", heat: 200 },
    ],
  },
];

export function missionState(index) {
  return { index, stage: 0, timer: 0, earned: 0, done: false, failed: false, hold: 0, banner: 0 };
}

export function currentMission(state) {
  if (state.mission.index >= MISSIONS.length) return null;
  return MISSIONS[state.mission.index];
}

export function missionTarget(state) {
  const m = currentMission(state);
  if (!m || state.mission.done) return null;
  const s = m.stages[state.mission.stage];
  if (!s) return null;
  if (s.type === 'goto' || s.type === 'rob') return { x: s.x, y: s.y, r: s.r || 90 };
  if (s.type === 'car') return null;
  return null;
}

/** Advance the active mission one step. Returns 'done' | 'failed' | null. */
export function updateMission(state, dt) {
  const m = currentMission(state);
  if (!m || state.mission.done) return null;
  const ms = state.mission;
  const s = m.stages[ms.stage];
  const p = state.player;
  if (s.time !== undefined) {
    ms.timer += dt;
    if (ms.timer > s.time) { ms.failed = true; return 'failed'; }
  }
  switch (s.type) {
    case 'car':
      if (p.inCar) return advance(state);
      break;
    case 'taxi':
      if (p.inCar && p.car && p.car.type === 'taxi') return advance(state);
      break;
    case 'goto': {
      if (dist(p.x, p.y, s.x, s.y) < s.r) {
        if (s.heat) state.crime += s.heat;
        return advance(state);
      }
      break;
    }
    case 'earn':
      if (ms.earned >= s.amount) return advance(state);
      break;
    case 'heat':
      if (state.wantedStars >= s.stars) return advance(state);
      break;
    case 'clean':
      if (state.wantedStars === 0) return advance(state);
      break;
    case 'rob': {
      if (dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) < 110) {
        ms.hold += dt;
        if (ms.hold >= s.seconds) {
          state.crime += 160;
          state.player.cash += 0;
          return advance(state);
        }
      } else {
        ms.hold = Math.max(0, ms.hold - dt * 2);
      }
      break;
    }
    default:
      break;
  }
  return null;
}

function advance(state) {
  const m = currentMission(state);
  const ms = state.mission;
  ms.stage += 1;
  ms.timer = 0;
  ms.hold = 0;
  if (ms.stage >= m.stages.length) {
    ms.done = true;
    state.player.cash += m.reward;
    state.missionsDone += 1;
    state.banner = `Job done: ${m.name}  +$${m.reward}`;
    state.bannerT = 3;
    return 'done';
  }
  return null;
}

export function missionText(state) {
  const m = currentMission(state);
  if (!m) return 'All jobs done — Vistamar is yours. Free roam!';
  if (state.mission.done) return 'Job done!';
  const s = m.stages[state.mission.stage];
  let text = s.text;
  if (s.type === 'earn') text += ` ($${Math.min(state.mission.earned, s.amount)}/$${s.amount})`;
  if (s.type === 'rob') text += ` (${Math.ceil(s.seconds - state.mission.hold)}s)`;
  if (s.time !== undefined) text += ` (${Math.max(0, Math.ceil(s.time - state.mission.timer))}s)`;
  return `${m.name}: ${text}`;
}
