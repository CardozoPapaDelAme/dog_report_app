// Generates music + sound effects as WAV files, 100% in code (no downloads).
import fs from 'node:fs';

const SR = 44100;
const scenes = JSON.parse(fs.readFileSync('src/scenes.json', 'utf8'));
const DUR = scenes.closing.to;
const N = Math.round(SR * DUR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;
const env = (t, a, d, s, r, len) => {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < len) return s;
  return Math.max(0, s * (1 - (t - len) / r));
};

function add(start, len, fn, gain = 1, pan = 0) {
  const s0 = Math.floor(start * SR);
  const n = Math.floor(len * SR);
  const gl = gain * (1 - Math.max(0, pan));
  const gr = gain * (1 + Math.min(0, pan));
  for (let i = 0; i < n && s0 + i < N; i++) {
    const v = fn(i / SR, i);
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

// ---------- Music: 100 BPM, A minor -> C major feel ----------
const BPM = 100;
const beat = 60 / BPM;
const bar = beat * 4;
const chords = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 55, 64], // C
  [55, 59, 62], // G
];
const bass = [45, 41, 36, 43];
const nBars = Math.ceil(DUR / bar);
for (let b = 0; b < nBars; b++) {
  const t0 = b * bar;
  const ch = chords[b % 4];
  const swell = Math.min(1, 0.35 + t0 / 12) * (t0 > DUR - 2.5 ? 0.8 : 1);
  // pad
  for (const m of ch) {
    for (const det of [-0.12, 0.12]) {
      add(t0, bar + 0.4, (t) => {
        const e = env(t, 0.5, 0.4, 0.8, 0.5, bar);
        return tri(midi(m) * (1 + det * 0.01) * t) * 0.045 * e * swell;
      }, 1, det > 0 ? 0.3 : -0.3);
    }
  }
  // bass pulse
  for (let k = 0; k < 4; k++) {
    add(t0 + k * beat, beat * 0.9, (t) => Math.sin(2 * Math.PI * midi(bass[b % 4]) * t) * 0.16 * env(t, 0.01, 0.15, 0.4, 0.1, beat * 0.7), 1, 0);
  }
  // arpeggio (starts after the hook)
  if (t0 >= 2.4) {
    for (let k = 0; k < 8; k++) {
      const m = ch[k % 3] + 12 + (k % 4 === 3 ? 12 : 0);
      add(t0 + k * beat * 0.5, beat * 0.5, (t) => Math.sin(2 * Math.PI * midi(m) * t) * 0.055 * env(t, 0.005, 0.12, 0.2, 0.15, beat * 0.3) * swell, 1, (k % 2 ? 0.4 : -0.4));
    }
  }
  // soft kick + hat from the camera scene on
  if (t0 >= 2.4) {
    for (let k = 0; k < 4; k++) {
      const kt = t0 + k * beat;
      add(kt, 0.25, (t) => Math.sin(2 * Math.PI * (110 * Math.exp(-t * 18) + 42) * t) * 0.32 * Math.exp(-t * 11), 1, 0);
      add(kt + beat * 0.5, 0.06, (t) => (Math.random() * 2 - 1) * 0.05 * Math.exp(-t * 60), 1, 0.2);
    }
  }
}

// ---------- SFX ----------
const whoosh = (t0, dur = 0.6, up = true) =>
  add(t0, dur, (t) => {
    const p = t / dur;
    const f = up ? 300 + 3200 * p * p : 3500 - 3000 * p;
    return (Math.random() * 2 - 1) * Math.sin(Math.PI * p) * 0.12 * (0.6 + 0.4 * Math.sin(2 * Math.PI * f * t * 0.002));
  }, 1, up ? -0.2 : 0.2);

const pop = (t0, f = 880, g = 0.18) =>
  add(t0, 0.16, (t) => Math.sin(2 * Math.PI * (f + 500 * Math.exp(-t * 40)) * t) * g * Math.exp(-t * 22), 1, (Math.random() - 0.5) * 0.6);

const click = (t0) => add(t0, 0.08, (t) => (Math.random() * 2 - 1) * 0.3 * Math.exp(-t * 90) + Math.sin(2 * Math.PI * 1800 * t) * 0.12 * Math.exp(-t * 70), 1, 0);
const tick = (t0, f = 1500) => add(t0, 0.05, (t) => Math.sin(2 * Math.PI * f * t) * 0.1 * Math.exp(-t * 80), 1, 0.1);
const ding = (t0, notes = [76, 81]) => notes.forEach((m, i) => add(t0 + i * 0.09, 0.9, (t) => Math.sin(2 * Math.PI * midi(m) * t) * 0.12 * Math.exp(-t * 4.5) + Math.sin(2 * Math.PI * midi(m) * 2 * t) * 0.03 * Math.exp(-t * 7), 1, 0));

// hook
whoosh(0.0, 0.7, true);
pop(0.55, 660, 0.2);
// phone enters
whoosh(2.4, 0.7, true);
const fr = (n) => n / 30;
const CAM = scenes.camera.from, TYPES = scenes.types.from, F = scenes.form.from, MAP = scenes.map.from;
const ZONE = scenes.zone.from, ASSOC = scenes.association.from, ADMIN = scenes.admin.from, CLOSING = scenes.closing.from;

// camera (local frames: focus 80, shutter 124, accepted 182; scene starts at frame 75)
whoosh(4.55, 0.5, true);
tick(fr(75 + 80), 1200);
click(fr(75 + 124));
whoosh(fr(75 + 124) + 0.07, 0.35, false);
ding(fr(75 + 182), [79, 84]);
// circle wipe to dark + phone leaves
whoosh(TYPES - 0.55, 0.7, false);
// types: six tags pop in, cursor picks "Human attack" (click at local frame 78)
[0.15, 0.3, 0.47, 0.63, 0.8, 0.97].forEach((t, i) => pop(TYPES + t, 520 + i * 70, 0.13));
click(TYPES + fr(78));
pop(TYPES + fr(80), 900, 0.16);
ding(TYPES + fr(84), [76, 81]);
// circle wipe to light + phone enters
whoosh(F - 0.55, 0.6, true);
// form: slowed taps (frame offsets from the scene start)
for (const o of [31, 84, 141, 167, 189, 211]) click(F + fr(o));
pop(F + fr(88), 700, 0.14);
click(F + fr(224));
ding(F + fr(232), [72, 79]);
// circle wipe to dark + phone returns (form -> map)
whoosh(MAP - 0.35, 0.5, true);
whoosh(MAP + 0.15, 0.55, false);
// map: ring + count card, heat toggle, back to groups
pop(MAP + fr(30), 760, 0.16);
pop(MAP + fr(34), 560, 0.14);
click(MAP + fr(69));
pop(MAP + fr(72), 520, 0.14);
whoosh(MAP + fr(81), 0.8, true);
click(MAP + fr(162));
pop(MAP + fr(165), 640, 0.13);
// zone: three visible taps + step pills
for (const o of [5, 128, 215]) {
  click(ZONE + fr(o));
  pop(ZONE + fr(o + 2), 640, 0.13);
}
pop(ZONE + fr(252), 760, 0.13);
// whip + circle wipe to light (zone -> association)
whoosh(ASSOC - 0.5, 0.5, true);
whoosh(ASSOC + 0.05, 0.55, false);
// association: count cards, period taps, checklist ticks
pop(ASSOC + fr(6), 700, 0.15);
click(ASSOC + fr(93));
pop(ASSOC + fr(96), 640, 0.13);
pop(ASSOC + fr(40), 980, 0.11);
pop(ASSOC + fr(54), 1100, 0.11);
pop(ASSOC + fr(118), 700, 0.14);
click(ASSOC + fr(231));
pop(ASSOC + fr(234), 640, 0.13);
// whip + circle wipe to dark (association -> admin)
whoosh(ADMIN - 0.5, 0.5, true);
whoosh(ADMIN + 0.15, 0.55, false);
// admin: three taps, cards
pop(ADMIN + fr(6), 640, 0.13);
click(ADMIN + fr(92));
pop(ADMIN + fr(95), 640, 0.13);
pop(ADMIN + fr(130), 760, 0.14);
click(ADMIN + fr(231));
pop(ADMIN + fr(234), 640, 0.13);
click(ADMIN + fr(291));
pop(ADMIN + fr(294), 640, 0.13);
// exit + closing
whoosh(CLOSING - 0.4, 0.6, false);
ding(CLOSING + 0.1, [72, 76, 79, 84]);
pop(CLOSING - 0.2, 900, 0.1);

// ---------- master: soft limiter, fades ----------
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > 0 ? 0.85 / peak : 1;
const out = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.3) * Math.min(1, (DUR - t) / 1.2);
  const l = Math.tanh(L[i] * norm * 1.1) * fade;
  const r = Math.tanh(R[i] * norm * 1.1) * fade;
  out.writeInt16LE(Math.round(l * 32767), i * 4);
  out.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + out.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(out.length, 40);
fs.mkdirSync('public', {recursive: true});
fs.writeFileSync('public/promo-audio.wav', Buffer.concat([hdr, out]));
console.log('wrote public/promo-audio.wav', (out.length / 1e6).toFixed(1), 'MB, peak', peak.toFixed(3));
