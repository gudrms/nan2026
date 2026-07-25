import { isMuted } from '../ai/ttsClient';

// 배경음악 — Web Audio 합성 5음계(국악 평조 느낌) 플럭 루프 (외부 에셋 0개).
// 기본 모드는 느긋하게, 플레이어 차례엔 빠르고 높은 패턴으로 전환된다.

const PENTA = [261.6, 293.7, 329.6, 392.0, 440.0]; // C D E G A
const PATTERN_BASE = [0, 2, 4, 2, 3, 1, 2, 0, 1, 3, 2, 4];
const PATTERN_PLAYER = [4, 2, 4, 3, 4, 2, 3, 4, 0, 3, 4, 2];

export type BgmMode = 'base' | 'player';

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let mode: BgmMode = 'base';
let step = 0;

function pluck(freq: number, gain: number) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  filter.type = 'lowpass';
  filter.frequency.value = 1300;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  osc.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.55);
}

function tick() {
  if (isMuted()) return;
  const pattern = mode === 'player' ? PATTERN_PLAYER : PATTERN_BASE;
  const octave = mode === 'player' ? 1.5 : 1;
  const accent = step % 4 === 0;
  pluck(PENTA[pattern[step % pattern.length]] * octave, accent ? 0.05 : 0.032);
  step += 1;
}

function restartTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, mode === 'player' ? 320 : 480);
}

export function startBgm() {
  if (timer) return;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    restartTimer();
  } catch {
    // 미지원 — 무음 진행
  }
}

export function setBgmMode(next: BgmMode) {
  if (mode === next) return;
  mode = next;
  step = 0;
  if (timer) restartTimer();
}

export function stopBgm() {
  if (timer) clearInterval(timer);
  timer = null;
}
