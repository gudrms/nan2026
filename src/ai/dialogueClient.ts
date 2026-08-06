import { isWellFormedLine } from './dialogueValidate';
import type { DialogueLine, Emotion } from './presetLines';

// /api/dialogue 호출 + 프리셋 폴백 (spec §3.2).
// 어떤 실패(타임아웃·404·잘못된 응답)에도 폴백 대사를 반환해 게임을 블로킹하지 않는다.

const TIMEOUT_MS = 3000;
const EMOTIONS = new Set<Emotion>(['neutral', 'joy', 'anger', 'surprise']);

export interface DialogueRequest {
  actor: string;
  event: string;
  situation: string;
  history: { actor: string; text: string }[];
}

// 로컬 vite dev에는 /api 함수가 없고 404 응답이 타임아웃까지 매달린다 →
// dev는 프리셋 폴백 모드로 즉시 동작 (spec §5 "Vite dev + 프리셋 폴백 모드")
const DEV_PRESET_MODE = import.meta.env.DEV && import.meta.env.MODE !== 'test';

export async function requestLine(req: DialogueRequest, fallback: DialogueLine): Promise<DialogueLine> {
  if (DEV_PRESET_MODE) return fallback;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/dialogue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      // 헤더 수신 후에도 본문 스트리밍이 멈출 수 있다 — 타이머는 본문을 다 읽을 때까지 유지해
      // res.json()도 타임아웃(abort) 보호를 받게 한다. 여기서 끊기면 게임 전체가 멎는다.
      const data: unknown = await res.json();
      const { text, emotion } = (data ?? {}) as { text?: unknown; emotion?: unknown };
      // 서버가 검증을 걸러도(방어 이중화) — 응답 스키마가 바뀌거나 서버 검증이 우회되는 경우 대비
      if (typeof text !== 'string' || !isWellFormedLine(text)) throw new Error('malformed text');
      return {
        actor: fallback.actor,
        text: text.slice(0, 80),
        emotion: EMOTIONS.has(emotion as Emotion) ? (emotion as Emotion) : fallback.emotion,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return fallback;
  }
}
