import { isMuted } from '../ai/ttsClient';

// 효과음 — 전량 Web Audio 합성 (외부 오디오 에셋 0개 원칙, CONCEPT §9)
// AudioContext는 첫 사용자 클릭 이후 생성/재개된다 (브라우저 자동재생 정책).
// 모든 실패는 조용히 무시 — 효과음은 곁가지다.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone(freq: number, dur: number, opts: ToneOpts = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  g.gain.setValueAtTime(opts.gain ?? 0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function woodClick(delay: number, gain = 0.2) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const dur = 0.05;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800 + Math.random() * 800;
  filter.Q.value = 1.5;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
}

/** 윷가락 4개가 바닥에 떨어지는 나무 소리 */
export function sfxThrow() {
  if (isMuted()) return;
  woodClick(0);
  woodClick(0.07);
  woodClick(0.12, 0.16);
  woodClick(0.19, 0.12);
}

/** 말 이동 — 가벼운 팝 */
export function sfxMove() {
  if (isMuted()) return;
  tone(520, 0.09, { type: 'triangle', slideTo: 700, gain: 0.1 });
}

/** 잡기 — 내리찍는 임팩트 */
export function sfxCapture() {
  if (isMuted()) return;
  tone(240, 0.22, { type: 'sawtooth', slideTo: 85, gain: 0.16 });
  woodClick(0.02, 0.25);
}

/** 업기 — 상승 2음 */
export function sfxStack() {
  if (isMuted()) return;
  tone(523, 0.1, { type: 'triangle', gain: 0.1 });
  tone(659, 0.14, { type: 'triangle', gain: 0.1, delay: 0.09 });
}

/** 윷·모 — 밝은 차임 */
export function sfxBonus() {
  if (isMuted()) return;
  tone(784, 0.12, { gain: 0.11, delay: 0.15 });
  tone(1047, 0.2, { gain: 0.11, delay: 0.27 });
}

/** 완주·승리 — 아르페지오 */
export function sfxFinish() {
  if (isMuted()) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { gain: 0.11, delay: i * 0.09 }));
}
