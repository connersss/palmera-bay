// Vistamar — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, game over.
//
// ?seed=N fixes the city. ?shot=drive|chase|foot|title (with &seed=N) stages
// that scene instead of running the loop and sets window.__shotReady.
import { STEP, WORLD_W, WORLD_H, clamp } from './config.js';
import { createWorld, stepWorld, loadSave } from './world.js';
import { render, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_PAUSE } from './render.js';
import { stageShot } from './shots.js';
import { ensureAudio, updateAudio, playPickup, playShot, playCrash, playMission } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');

const input = { up: false, down: false, left: false, right: false, action: false, attack: false, weapon: false };
let screen = SCREEN_TITLE;
let world = createWorld(seed);
let camera = { x: 0, y: 0 };
let last = performance.now();
let acc = 0;
let lastHealth = world.player.health;
let lastCash = world.player.cash;
let lastStars = 0;
let lastMissionsDone = world.missionsDone;

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (KEYMAP[e.code] !== undefined) {
    input[KEYMAP[e.code]] = true;
    e.preventDefault();
  }
  if (e.code === 'KeyE' && screen === SCREEN_PLAY) input.action = true;
  if (e.code === 'KeyF' && screen === SCREEN_PLAY) input.attack = true;
  if (e.code === 'Digit2' && screen === SCREEN_PLAY) input.weapon = true;
  if (e.code === 'Enter' && screen === SCREEN_TITLE) {
    screen = SCREEN_PLAY;
    world.banner = 'First job: steal a car';
    world.bannerT = 3;
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
    screen = screen === SCREEN_PLAY ? SCREEN_PAUSE : SCREEN_PLAY;
  }
  if (e.code === 'KeyR' && screen === SCREEN_OVER) {
    world = createWorld(seed);
    screen = SCREEN_TITLE;
    lastHealth = world.player.health;
    lastCash = world.player.cash;
    lastStars = 0;
  }
});

window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
});

function updateCamera() {
  const p = world.player;
  const tx = clamp(p.x - 640, 0, WORLD_W - 1280);
  const ty = clamp(p.y - 360, 0, WORLD_H - 720);
  camera.x += (tx - camera.x) * 0.12;
  camera.y += (ty - camera.y) * 0.12;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (screen === SCREEN_PLAY && !world.over) {
    acc += dt;
    while (acc >= STEP) {
      stepWorld(world, input, STEP);
      acc -= STEP;
    }
    if (world.player.health < lastHealth) playCrash();
    if (world.player.cash > lastCash) playPickup();
    if (world.player.cash < lastCash) playShot();
    if (world.wantedStars > lastStars) playShot();
    if (world.missionsDone > lastMissionsDone) playMission();
    lastHealth = world.player.health;
    lastCash = world.player.cash;
    lastStars = world.wantedStars;
    lastMissionsDone = world.missionsDone;
    if (world.over) screen = SCREEN_OVER;
    updateAudio(world);
  }
  updateCamera();
  ctx.clearRect(0, 0, 1280, 720);
  render(ctx, world, screen, camera);
}

if (shotName) {
  // Screenshot mode: stage the scene once, paint it, signal readiness.
  const staged = stageShot(shotName, seed);
  world = staged.world;
  screen = staged.screen;
  updateCamera();
  camera.x = clamp(world.player.x - 640, 0, WORLD_W - 1280);
  camera.y = clamp(world.player.y - 360, 0, WORLD_H - 720);
  render(ctx, world, screen, camera);
  render(ctx, world, screen, camera);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
