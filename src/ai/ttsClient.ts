// /api/tts 호출 + 순차 재생 큐 (spec §4.4)
// - 대사가 겹치면 순차 재생, 대기 2개 초과 시 오래된 것 드롭 (템포 우선)
// - speak()는 "해당 대사의 재생이 끝나는 시점"에 resolve → 말풍선 수명을 음성과 동기화
// - 모든 실패는 조용히 무시(즉시 resolve) — 음성은 곁가지, 게임·말풍선은 항상 정상 동작

const FETCH_TIMEOUT_MS = 5000;
const MAX_QUEUE = 2;

interface QueueItem {
  blob: Blob;
  resolve: () => void;
  /** 실제 재생 시작 시 호출 (재생 길이 초 전달) — 말풍선 타자기 동기화용 */
  onStart?: (durationSec: number | null) => void;
}

let muted = false;
let playing = false;
const queue: QueueItem[] = [];
let current: { audio: HTMLAudioElement; finish: () => void } | null = null;

export function setMuted(value: boolean) {
  muted = value;
  if (muted) {
    for (const item of queue) item.resolve();
    queue.length = 0;
    current?.audio.pause();
    current?.finish();
  }
}

export function isMuted() {
  return muted;
}

function playNext() {
  if (playing || muted) return;
  const item = queue.shift();
  if (!item) return;
  playing = true;
  const url = URL.createObjectURL(item.blob);
  const audio = new Audio(url);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    URL.revokeObjectURL(url);
    item.resolve();
    current = null;
    playing = false;
    playNext();
  };
  current = { audio, finish };
  audio.onended = finish;
  audio.onerror = finish;
  audio.onplaying = () => {
    item.onStart?.(Number.isFinite(audio.duration) ? audio.duration : null);
  };
  audio.play().catch(finish); // 자동재생 정책 등으로 거부되면 조용히 다음으로
}

/** 재생이 끝나면(또는 재생 불가로 스킵되면) resolve. onStart는 실제 재생 시작 시 호출 */
// 로컬 vite dev에는 /api 함수가 없다 → 즉시 무음 스킵 (dialogueClient와 동일한 이유)
const DEV_PRESET_MODE = import.meta.env.DEV && import.meta.env.MODE !== 'test';

export async function speak(
  actor: string,
  text: string,
  onStart?: (durationSec: number | null) => void,
): Promise<void> {
  if (muted || DEV_PRESET_MODE) return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor, text }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok || !res.headers.get('content-type')?.includes('audio')) return;
    const blob = await res.blob();
    return new Promise<void>((resolve) => {
      queue.push({ blob, resolve, onStart });
      while (queue.length > MAX_QUEUE) queue.shift()?.resolve(); // 오래된 것 드롭
      playNext();
    });
  } catch {
    // 침묵 — 말풍선만으로 진행
  }
}
