// Quiet interface sounds, synthesised with Web Audio — no audio files.
//
// Rules (Apple, "Designing Audio-Haptic Experiences"):
//   causality — a sound only answers something the user did;
//   harmony   — it fires on pointerdown, the same frame as the :active state;
//   utility   — taps get a barely-there tick, only menus and selections get a tone.
// Keyboard actions stay silent, the same way they stay unanimated.

type Cue = 'tick' | 'open' | 'close' | 'select' | 'on';

const KEY = 'sound';
let ctx: AudioContext | null = null;
let master: GainNode;
let noise: AudioBuffer;

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    // iOS: respect the silent switch and never interrupt the user's music.
    const session = (navigator as any).audioSession;
    if (session) session.type = 'ambient';
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(c: AudioContext, freq: number, at: number, dur: number, vol: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at); o.stop(at + dur + 0.02);
}

function tick(c: AudioContext, at: number) {
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise;
  bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.4;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.32, at + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
  src.connect(bp).connect(g).connect(master);
  src.start(at); src.stop(at + 0.05);
}

export function play(cue: Cue, force = false) {
  if ((!force && !soundOn()) || document.hidden) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  switch (cue) {
    case 'tick': tick(c, t); break;
    case 'open': tone(c, 740, t, 0.16, 0.12); tone(c, 1110, t + 0.05, 0.22, 0.09); break;
    case 'close': tone(c, 1110, t, 0.14, 0.09); tone(c, 740, t + 0.045, 0.2, 0.1); break;
    case 'select': tone(c, 988, t, 0.12, 0.07); tone(c, 1480, t, 0.08, 0.025); break;
    case 'on': tone(c, 660, t, 0.14, 0.09); tone(c, 880, t + 0.06, 0.14, 0.09); tone(c, 1320, t + 0.12, 0.24, 0.07); break;
  }
}

/** A short vibration on meaningful commits. Android only; iOS has no API. */
export function haptic() {
  if (soundOn() && 'vibrate' in navigator) navigator.vibrate(8);
}

/** Taps on anything interactive, plus the on/off toggles. Call once per page. */
export function initSound() {
  const TAPPABLE = 'a, button, summary, [role="button"], .history-cal__cell';
  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(TAPPABLE);
    if (!el || el.closest('[data-sound-skip]')) return;
    play('tick');
  }, { passive: true });

  const toggles = document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]');
  const render = () => toggles.forEach((b) => {
    const on = soundOn();
    b.setAttribute('aria-pressed', String(on));
    const label = b.querySelector('[data-sound-label]');
    if (label) label.textContent = on ? 'Sound on' : 'Sound off';
  });
  toggles.forEach((b) => b.addEventListener('click', () => {
    const on = !soundOn();
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
    render();
    if (on) play('on', true);
  }));
  render();
}
