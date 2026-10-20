// Robot sounds for Deck 7, synthesized on the fly with Web Audio (no files, nothing leaves the
// machine). Beeps are on by default; the ambient station hum is off by default. Both are
// remembered on this computer.

export type Cue = "done" | "error" | "needs" | "start" | "click" | "hire" | "kick" | "goal" | "janitor";

const KEY = "worklive.deck7.sound";
const prefs = (() => { try { return { beeps: true, ambient: false, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { beeps: true, ambient: false }; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ } };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let lastCue = 0;
let unlocked = false; // no audio until the user has clicked something (browser autoplay rules)

function audio() {
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
// Browsers only allow audio after a user gesture; the first click anywhere unlocks it.
addEventListener("pointerdown", () => { unlocked = true; audio(); if (prefs.ambient) startAmbient(); }, { once: true, capture: true });

function tone(freq: number, at: number, dur: number, type: OscillatorType = "square", vol = 0.12, slideTo?: number) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}
function noise(at: number, dur: number, vol = 0.08, cutoff = 800) {
  const c = ctx!, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = "lowpass"; f.frequency.value = cutoff; g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(at);
}

/** Play a short robot sound. Rate-limited so a busy deck doesn't turn into a chiptune. */
export function cue(kind: Cue) {
  if (!prefs.beeps) return;
  const c = audio();
  if (!c || c.state !== "running") return;
  const now = c.currentTime;
  if (kind !== "click" && now - lastCue < 0.25) return;
  lastCue = now;
  switch (kind) {
    case "done": [660, 880, 1320].forEach((f, i) => tone(f, now + i * 0.09, 0.14, "square", 0.09)); break; // happy chirp
    case "error": tone(140, now, 0.32, "sawtooth", 0.12, 90); tone(147, now, 0.32, "sawtooth", 0.08, 95); break; // grumpy buzz
    case "needs": tone(988, now, 0.18, "sine", 0.14); tone(740, now + 0.2, 0.28, "sine", 0.14); break; // ding-dong
    case "start": tone(220, now, 0.28, "triangle", 0.1, 880); break; // power-up sweep
    case "click": tone(1200, now, 0.05, "square", 0.05, 900); break; // blip
    case "hire": noise(now, 0.18, 0.2, 300); tone(330, now + 0.15, 0.4, "sine", 0.12, 660); tone(660, now + 0.3, 0.22, "square", 0.05, 990); break; // thud + boing
    case "kick": tone(180, now, 0.08, "triangle", 0.16, 90); break; // pok
    case "goal": [523, 659, 784, 1046].forEach((f, i) => tone(f, now + i * 0.11, 0.2, "square", 0.08)); break;
    case "janitor": tone(90, now, 0.6, "sawtooth", 0.04, 70); noise(now, 0.6, 0.05, 2000); break; // vacuum
  }
}

// Ambient: a low station hum with a slow wobble, plus the occasional gurgle of the oil machine.
let gurgle: number | undefined;
function startAmbient() {
  const c = audio();
  if (!c || ambientNodes.length) return;
  const g = c.createGain();
  g.gain.value = 0.035;
  g.connect(master!);
  const hum = c.createOscillator(), hum2 = c.createOscillator(), lfo = c.createOscillator(), lfoGain = c.createGain();
  hum.type = "sine"; hum.frequency.value = 55;
  hum2.type = "sine"; hum2.frequency.value = 110.6;
  lfo.frequency.value = 0.15; lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(g.gain);
  hum.connect(g); hum2.connect(g);
  hum.start(); hum2.start(); lfo.start();
  ambientNodes = [hum, hum2, lfo, g];
  gurgle = window.setInterval(() => { if (ctx && prefs.ambient && Math.random() < 0.35) { const t = ctx.currentTime; for (let i = 0; i < 4; i++) tone(180 + Math.random() * 120, t + i * 0.07, 0.06, "sine", 0.02); } }, 7000);
}
function stopAmbient() {
  ambientNodes.forEach(n => { try { (n as OscillatorNode).stop?.(); } catch { /* not started */ } n.disconnect(); });
  ambientNodes = [];
  clearInterval(gurgle);
}

export const sound = {
  get beeps() { return prefs.beeps as boolean; },
  get ambient() { return prefs.ambient as boolean; },
  setBeeps(on: boolean) { prefs.beeps = on; save(); if (on) cue("click"); },
  setAmbient(on: boolean) { prefs.ambient = on; save(); if (on) startAmbient(); else stopAmbient(); },
};

// Jukebox: a tiny looping chiptune while robots dance (only with the ambient sound switched on).
let jukeTimer: number | undefined;
const TUNE = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 988, 784, 659, 587];
export function jukeboxMusic(on: boolean) {
  if (on && prefs.ambient && !jukeTimer) {
    let i = 0;
    jukeTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== "running" || !prefs.ambient) return;
      const t = ctx.currentTime;
      tone(TUNE[i % TUNE.length], t, 0.16, "square", 0.025);
      if (i % 4 === 0) tone(TUNE[i % TUNE.length] / 4, t, 0.3, "triangle", 0.03);
      i++;
    }, 210);
  } else if ((!on || !prefs.ambient) && jukeTimer) { clearInterval(jukeTimer); jukeTimer = undefined; }
}
