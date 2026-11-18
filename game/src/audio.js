// Vistamar — sound with no audio files: a tiny WebAudio synth for the engine
// hum, the police siren, pickups, shots and crashes. Silent until the first key.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenHigh = false;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
  } catch {
    ctx = null;
  }
}

function blip(freq, dur, type, vol) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* ignore */ }
}

export function playPickup() { blip(880, 0.12, 'square', 0.07); setTimeout(() => blip(1320, 0.12, 'square', 0.07), 70); }
export function playShot() { blip(180, 0.09, 'sawtooth', 0.14); }
export function playCrash() { blip(70, 0.25, 'sawtooth', 0.16); }
export function playMission() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'square', 0.08), i * 90)); }

/** Call every frame: engine pitch follows speed, siren wails with the heat. */
export function updateAudio(state) {
  if (!ctx || !engineOsc) return;
  const p = state.player;
  const speed = Math.abs(p.carSpeed || 0);
  engineGain.gain.value = p.inCar ? 0.035 + Math.min(0.05, speed / 9000) : 0;
  engineOsc.frequency.value = 60 + speed * 0.35;
  const wail = state.wantedStars > 0;
  sirenGain.gain.value = wail ? 0.035 : 0;
  if (wail) {
    sirenHigh = !sirenHigh;
    sirenOsc.frequency.value = sirenHigh ? 720 : 540;
  }
}
