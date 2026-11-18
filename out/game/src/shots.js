// Vistamar — the screenshot scenes behind ?shot=drive|chase|foot|title.
// Each one plays the real rules forward from a fresh world for a fixed time,
// steered by a road-following autopilot (stay on the asphalt, steer around
// buildings, reverse out when wedged), so the frame is what a short game
// really looks like and the same seed always gives the same frame.
import { STEP, clamp, angleDiff, angleTo, dist, circleHitsRect, ROADS_X, ROADS_Y, ROAD_W } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { missionTarget } from './missions.js';
import { onRoad, nearestRoadPoint } from './city.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

function pointInBuilding(x, y, buildings) {
  for (const b of buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

function nearestRoadLine(roads, v) {
  let best = roads[0];
  for (const r of roads) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}

/** Next grid waypoint: the intersection that moves the car toward the target
 *  along the roads. The car drives down one road, turns, then down the next. */
function gridWaypoint(car, target) {
  const vx = nearestRoadLine(ROADS_X, car.x);
  const hy = nearestRoadLine(ROADS_Y, car.y);
  const tvx = nearestRoadLine(ROADS_X, target.x);
  const thy = nearestRoadLine(ROADS_Y, target.y);
  // A car counts as on a road while its centre is near the centre line; the
  // margin is a little wider than the asphalt so a drifted car does not flip
  // out of road mode and cut diagonally across a block.
  const onV = Math.abs(car.x - vx) <= ROAD_W / 2 + 8;
  const onH = Math.abs(car.y - hy) <= ROAD_W / 2 + 8;
  if (onV && !onH) {
    if (Math.abs(car.x - target.x) > 90) return { x: vx, y: thy };
    return { x: vx, y: target.y };
  }
  if (onH && !onV) {
    if (Math.abs(car.y - target.y) > 90) return { x: tvx, y: hy };
    return { x: target.x, y: hy };
  }
  return { x: tvx, y: thy };
}

/** Steer the player car toward the current waypoint, on the roads, around
 *  buildings, and out of a wedge. Returns the input for one step. */
export function driveAutopilot(state) {
  const p = state.player;
  const input = { up: false, down: false, left: false, right: false, action: false, attack: false, weapon: false };
  if (!p.inCar) {
    let best = null; let bd = Infinity;
    for (const car of state.cars) {
      if (car.driver === 'police') continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      const a = angleTo(p.x, p.y, best.x, best.y);
      const dx = Math.cos(a); const dy = Math.sin(a);
      input.right = dx > 0.3; input.left = dx < -0.3;
      input.down = dy > 0.3; input.up = dy < -0.3;
      if (bd < 60) input.action = true;
    }
    return input;
  }
  const car = p.car;
  const target = state.driveTarget || missionTarget(state) || { x: 2900, y: 2100 };
  const ap = state._ap || (state._ap = { stuckT: 0, reverseT: 0, side: -1 });
  // Stuck detection: speed near zero while trying to drive means wedged.
  if (Math.abs(car.speed) < 40) ap.stuckT += STEP; else ap.stuckT = 0;
  if (ap.stuckT > 1.2 && ap.reverseT <= 0) { ap.reverseT = 0.9; ap.stuckT = 0; }
  if (ap.reverseT > 0) {
    ap.reverseT -= STEP;
    input.down = true;
    input.left = angleDiff(car.angle, angleTo(car.x, car.y, target.x, target.y)) > 0;
    input.right = !input.left;
    return input;
  }
  // Grid route: drive along the roads, turning at intersections, instead of
  // cutting diagonally across blocks (where the buildings are).
  let tx = target.x; let ty = target.y;
  if (dist(car.x, car.y, target.x, target.y) > 130) {
    const wp = gridWaypoint(car, target);
    tx = wp.x; ty = wp.y;
  }
  // If off the asphalt, steer back to the nearest road first.
  if (!onRoad(car.x, car.y)) {
    const rp = nearestRoadPoint(car.x, car.y);
    tx = rp.x; ty = rp.y;
  }
  let want = angleTo(car.x, car.y, tx, ty);
  // Building dead ahead? Steer to the clearer side.
  const fx = Math.cos(car.angle); const fy = Math.sin(car.angle);
  const aheadX = car.x + fx * 110; const aheadY = car.y + fy * 110;
  if (pointInBuilding(aheadX, aheadY, state.city.buildings)) {
    const lx = car.x - fy * 110; const ly = car.y + fx * 110;
    const rx = car.x + fy * 110; const ry = car.y - fx * 110;
    const leftClear = !pointInBuilding(lx, ly, state.city.buildings);
    const rightClear = !pointInBuilding(rx, ry, state.city.buildings);
    const side = leftClear && !rightClear ? -1 : rightClear && !leftClear ? 1 : (ap.side || (ap.side = -1));
    want = car.angle + side * 1.1;
  }
  const diff = angleDiff(car.angle, want);
  const speed = Math.abs(p.carSpeed || 0);
  input.right = diff > 0.06;
  input.left = diff < -0.06;
  input.up = true;
  // Brake early for a waypoint when a turn follows it (the next leg leaves
  // at an angle), so the car makes the corner instead of overshooting it.
  const dWp = dist(car.x, car.y, tx, ty);
  let needBrake = false;
  if (dWp < 320) {
    const turnAfter = Math.abs(angleDiff(car.angle, angleTo(tx, ty, target.x, target.y)));
    if (turnAfter > 0.7 && speed > 150) needBrake = true;
  }
  if (needBrake || (Math.abs(diff) > 1.0 && speed > 220)) { input.up = false; input.down = true; }
  return input;
}

/** Put the player in the sports car and place it on a road far from the
 *  garage, facing into the city, so the scene is a real drive, not a spawn. */
export function placeSportsCar(world, x, y, angle) {
  const gt = world.cars.find((c) => c.type === 'sports');
  const p = world.player;
  gt.x = x; gt.y = y; gt.angle = angle; gt.speed = 0; gt.driver = 'player';
  p.inCar = true; p.car = gt;
  p.x = x; p.y = y; p.angle = angle;
  world.crime += 25;
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, seed) {
  const world = createWorld(seed);
  const run = (seconds, autopilot) => {
    const steps = Math.floor(seconds / STEP);
    for (let i = 0; i < steps; i += 1) {
      const input = autopilot ? autopilot(world) : { up: false, down: false, left: false, right: false, action: false, attack: false, weapon: false };
      stepWorld(world, input, STEP);
      if (world.over) break;
    }
    return world;
  };
  if (name === 'title') {
    run(5, null);
    return { world, screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    // Sports car on the northbound avenue with the heat on, VCPD on the tail.
    // A straight run to the garage keeps the car on the asphalt at speed.
    placeSportsCar(world, 600, 2000, -Math.PI / 2);
    world.crime = 200;
    run(7, driveAutopilot);
    return { world, screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    // On foot by the garage with Mara's first job open and pedestrians about.
    run(6, (w) => {
      const input = { up: false, down: false, left: false, right: false, action: false, attack: false, weapon: false };
      const p = w.player;
      const a = angleTo(p.x, p.y, 700, 700);
      input.right = Math.cos(a) > 0.3; input.left = Math.cos(a) < -0.3;
      input.down = Math.sin(a) > 0.3; input.up = Math.sin(a) < -0.3;
      return input;
    });
    return { world, screen: SCREEN_PLAY };
  }
  // 'drive' (default): sports car on the northbound avenue, driving straight
  // in to the garage — a real run at speed with the waypoint ahead.
  placeSportsCar(world, 600, 2000, -Math.PI / 2);
  run(5.5, driveAutopilot);
  return { world, screen: SCREEN_PLAY };
}
