import { isMuted } from '../ai/ttsClient';
import type { YutName } from '../game/throwYut';

// 사회자 음성 — 브라우저 내장 Web Speech API (무료·로컬, API 과금 0).
// 턴 안내("범발톱 차례")와 도개걸윷모 콜("걸!")만 담당. 캐릭터 대사 TTS와는 별개.

const YUT_CALL: Record<YutName, string> = { do: '도!', gae: '개!', geol: '걸!', yut: '윷!', mo: '모!' };

function say(text: string, rate: number, pitch: number) {
  if (isMuted()) return;
  try {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel(); // 밀린 안내는 버린다 (템포 우선)
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 0.9;
    speechSynthesis.speak(u);
  } catch {
    // 미지원 브라우저 — 조용히 무시
  }
}

export function announceTurn(nameKo: string) {
  say(`${nameKo} 차례`, 1.25, 1.05);
}

export function announceResult(name: YutName) {
  say(YUT_CALL[name], 1.0, 1.25);
}

export function stopNarrator() {
  try {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  } catch {
    // 무시
  }
}
