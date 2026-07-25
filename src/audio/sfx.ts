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

/** 윷가락 4개가 바닥에 떨어지는 나무 소리 — 토스 애니메이션(0.68s) 낙하에 맞춰 지연 */
export function sfxThrow() {
  if (isMuted()) return;
  woodClick(0.5, 0.5);
  woodClick(0.57, 0.45);
  woodClick(0.62, 0.4);
  woodClick(0.69, 0.32);
}

/** 도개걸윷모 결과음 — 등급이 오를수록 높은 음계 (도=1 ~ 모=5) */
export function sfxResult(steps: number, bonus: boolean) {
  if (isMuted()) return;
  const base = [0, 392, 440, 494, 587, 659][Math.min(steps, 5)];
  tone(base, 0.16, { gain: 0.26 });
  tone(base * 1.5, 0.22, { gain: 0.24, delay: 0.1 });
  if (bonus) {
    tone(base * 2, 0.26, { gain: 0.24, delay: 0.22 });
    woodClick(0.22, 0.3);
  }
}

/** 스텝 이동 — 칸마다 올라가는 팝 (i = 스텝 인덱스) */
export function sfxStep(i: number) {
  if (isMuted()) return;
  tone(480 + i * 70, 0.08, { type: 'triangle', slideTo: 620 + i * 70, gain: 0.22 });
}

/** 잡기 — 바닥 붐 + 내리찍기 이중 임팩트 (기획 피드백: 강하게) */
export function sfxCapture() {
  if (isMuted()) return;
  tone(80, 0.4, { type: 'sine', slideTo: 45, gain: 0.5 });
  tone(260, 0.28, { type: 'sawtooth', slideTo: 70, gain: 0.34 });
  woodClick(0, 0.6);
  woodClick(0.06, 0.5);
}

/** 업기 — 상승 2음 */
export function sfxStack() {
  if (isMuted()) return;
  tone(523, 0.1, { type: 'triangle', gain: 0.22 });
  tone(659, 0.14, { type: 'triangle', gain: 0.22, delay: 0.09 });
}

/** 완주·승리 — 아르페지오 */
export function sfxFinish() {
  if (isMuted()) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { gain: 0.24, delay: i * 0.09 }));
}
