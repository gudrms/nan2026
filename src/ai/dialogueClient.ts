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

export async function requestLine(req: DialogueRequest, fallback: DialogueLine): Promise<DialogueLine> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch('/api/dialogue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const data: unknown = await res.json();
    const { text, emotion } = (data ?? {}) as { text?: unknown; emotion?: unknown };
    if (typeof text !== 'string' || text.length === 0) throw new Error('empty text');
    return {
      actor: fallback.actor,
      text: text.slice(0, 80),
      emotion: EMOTIONS.has(emotion as Emotion) ? (emotion as Emotion) : fallback.emotion,
    };
  } catch {
    return fallback;
  }
}
