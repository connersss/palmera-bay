// Vistamar — everything the player sees: the city from above, the cars and
// people in it, the HUD with its live minimap, and the title and end screens.
// The world layer is drawn in world coordinates under one camera translate;
// the HUD and overlays are drawn in screen coordinates after it.
import {
  WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y, BEACH_Y, COLORS, clamp, dist,
} from './config.js';
import { PLACES } from './city.js';
import { missionText, missionTarget, currentMission } from './missions.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_OVER = 2;
export const SCREEN_PAUSE = 3;

const VIEW_W = 1280;
const VIEW_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const def = car.def;
  const L = def.len; const W = def.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, -L / 6, -W / 2 + 4, L / 3, W - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(L / 6, -W / 2 + 5, 4, W - 10);
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#a02020';
  ctx.fillRect(-L / 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2, W / 2 - 7, 3, 5);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-L / 4, -W / 2 + 2, L / 2, 4);
    ctx.fillStyle = car.siren < 0.5 ? '#ff2020' : '#2050ff';
    ctx.beginPath(); ctx.arc(0, -W / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = car.siren < 0.5 ? '#2050ff' : '#ff2020';
    ctx.beginPath(); ctx.arc(0, W / 2 + 2, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 4.5, 0, Math.PI * 2); ctx.fill();
  if (ped.hail) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -20); ctx.stroke();
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, -22);
  }
  ctx.restore();
}

export function render(ctx, state, screen, camera) {
  const p = state.player;
  // --- world layer, in world coordinates ---
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  // ground
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = COLORS.grassDark;
  for (let gx = 0; gx < WORLD_W; gx += 400) {
    for (let gy = 0; gy < BEACH_Y; gy += 400) {
      if (((gx + gy) / 400) % 2 === 0) ctx.fillRect(gx, gy, 400, 400);
    }
  }
  // beach + sea
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, BEACH_Y, WORLD_W, WORLD_H - BEACH_Y);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(0, BEACH_Y + 90, WORLD_W, WORLD_H - BEACH_Y - 90);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, BEACH_Y + 90);
  ctx.lineTo(WORLD_W, BEACH_Y + 90);
  ctx.stroke();
  // roads
  ctx.fillStyle = COLORS.asphalt;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.strokeStyle = COLORS.asphaltLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const rx of ROADS_X) { ctx.moveTo(rx, 0); ctx.lineTo(rx, BEACH_Y); }
  for (const ry of ROADS_Y) { ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // parks + trees
  for (const park of state.city.parks) {
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  ctx.fillStyle = COLORS.tree;
  for (const t of state.city.trees) {
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
  }
  // buildings
  for (const b of state.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,240,180,0.75)';
    for (let wy = b.y + 16; wy < b.y + b.h - 10; wy += 26) {
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 22) {
        ctx.fillRect(wx, wy, 9, 12);
      }
    }
  }
  // named places
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    const pulse = 1 + 0.12 * Math.sin(state.time * 3 + key.length);
    ctx.save();
    ctx.translate(pl.x, pl.y);
    ctx.fillStyle = pl.color;
    ctx.beginPath(); ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(key === 'garage' ? 'G' : key === 'bank' ? '$' : key === 'spray' ? 'S' : key === 'hospital' ? '+' : key === 'marina' ? 'M' : key === 'park' ? 'P' : 'T', 0, 1);
    ctx.restore();
  }
  // mission / fare waypoint beacon
  const target = missionTarget(state) || (state.fare ? { x: state.fare.x, y: state.fare.y, r: 70 } : null);
  if (target) {
    const bob = Math.sin(state.time * 4) * 6;
    ctx.save();
    ctx.translate(target.x, target.y + bob);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(0, 14); ctx.lineTo(-11, -8); ctx.lineTo(11, -8); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,225,77,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, (target.r || 80) * (0.9 + 0.1 * Math.sin(state.time * 3)), 0, Math.PI * 2);
    ctx.stroke();
  }
  // cars, pedestrians, cops
  for (const car of state.cars) drawCar(ctx, car);
  for (const ped of state.peds) drawPed(ctx, ped);
  for (const cop of state.cops) {
    if (cop.onFoot) {
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.fillStyle = '#1e2a3a';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8e4f0';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // player (on foot only; in a car the car itself is the player)
  if (!p.inCar) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // muzzle flash
  if (state.shot) {
    ctx.save();
    ctx.translate(state.shot.x, state.shot.y);
    ctx.rotate(state.shot.angle);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(40, -7); ctx.lineTo(40, 7); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // --- screen layer: off-screen waypoint arrow, HUD, overlays ---
  if (target) {
    const sx = target.x - camera.x; const sy = target.y - camera.y;
    if (sx < 30 || sx > VIEW_W - 30 || sy < 30 || sy > VIEW_H - 30) {
      const cx = clamp(sx, 50, VIEW_W - 50);
      const cy = clamp(sy, 50, VIEW_H - 50);
      const a = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  drawHud(ctx, state, screen);
  if (screen === SCREEN_TITLE) drawTitle(ctx, state);
  if (screen === SCREEN_PAUSE) drawPause(ctx);
  if (screen === SCREEN_OVER) drawOver(ctx, state);
}

function drawHud(ctx, state, screen) {
  const p = state.player;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 12, 420, 64);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${Math.floor(p.cash)}`, 26, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(missionText(state), 26, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(VIEW_W - 214, 12, 200, 44);
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < state.wantedStars ? '★' : '☆';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(stars, VIEW_W - 200, 44);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, VIEW_H - 52, 230, 38);
  ctx.fillStyle = '#333';
  ctx.fillRect(24, VIEW_H - 40, 160, 14);
  ctx.fillStyle = p.health > 50 ? '#7ee787' : p.health > 25 ? '#e8a13c' : '#e84d3c';
  ctx.fillRect(24, VIEW_H - 40, 160 * clamp(p.health / 100, 0, 1), 14);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(p.weapon === 'pistol' ? `Pistol ${p.ammo}` : 'Fists', 192, VIEW_H - 27);
  if (p.inCar) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW_W / 2 - 70, VIEW_H - 52, 140, 38);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(Math.abs(p.carSpeed) * 0.9)} km/h`, VIEW_W / 2, VIEW_H - 26);
    ctx.textAlign = 'left';
  }
  if (state.bannerT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const w = ctx.measureText(state.banner).width + 36;
    ctx.fillRect(VIEW_W / 2 - w / 2, 92, w, 36);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner, VIEW_W / 2, 116);
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, state);
}

function drawMinimap(ctx, state) {
  const mw = 220; const mh = 165;
  const mx = VIEW_W - mw - 14; const my = VIEW_H - mh - 14;
  const sx = mw / WORLD_W; const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#2e5d2e';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#5a5a5a';
  for (const rx of ROADS_X) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
  for (const ry of ROADS_Y) ctx.fillRect(mx, my + ry * sy, mw, 4);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx, my + 2260 * sy, mw, mh - 2260 * sy);
  const target = missionTarget(state) || (state.fare ? { x: state.fare.x, y: state.fare.y } : null);
  if (target) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const cop of state.cops) {
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(10,16,28,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VISTAMAR', VIEW_W / 2, 250);
  ctx.fillStyle = '#fff';
  ctx.font = '24px sans-serif';
  ctx.fillText('A sun-soaked open-world crime game', VIEW_W / 2, 295);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#c8d8e8';
  ctx.fillText('WASD drive & walk  •  E steal / exit car  •  F punch / shoot  •  2 switch weapon', VIEW_W / 2, 350);
  ctx.fillText('Missions for Mara Voss  •  Taxi fares  •  Pay & Spray clears the heat  •  P pause', VIEW_W / 2, 380);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press ENTER to play', VIEW_W / 2, 450);
  ctx.fillStyle = '#8aa0b8';
  ctx.font = '15px sans-serif';
  ctx.fillText(state.player.cash > 0 ? `Saved cash: $${Math.floor(state.player.cash)}  •  Jobs done: ${state.missionsDone}` : 'New game — good luck out there', VIEW_W / 2, 500);
  ctx.textAlign = 'left';
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(10,16,28,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_W / 2, 350);
  ctx.font = '20px sans-serif';
  ctx.fillText('Press P to keep playing', VIEW_W / 2, 395);
  ctx.textAlign = 'left';
}

function drawOver(ctx, state) {
  ctx.fillStyle = 'rgba(20,8,8,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = state.over === 'busted' ? '#7db4ff' : '#ff6a5a';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.over === 'busted' ? 'BUSTED' : 'WASTED', VIEW_W / 2, 320);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText(`Cash kept: $${Math.floor(state.player.cash)}  •  Jobs done: ${state.missionsDone}`, VIEW_W / 2, 370);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press R to run it back', VIEW_W / 2, 430);
  ctx.textAlign = 'left';
}
