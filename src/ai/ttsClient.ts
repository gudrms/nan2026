// /api/tts 호출 + 순차 재생 큐 (spec §4.4)
// - 대사가 겹치면 순차 재생, 대기 2개 초과 시 오래된 것 드롭 (템포 우선)
// - 모든 실패는 조용히 무시 — 음성은 곁가지, 게임·말풍선은 항상 정상 동작

const FETCH_TIMEOUT_MS = 5000;
const MAX_QUEUE = 2;

let muted = false;
let playing = false;
const queue: Blob[] = [];

export function setMuted(value: boolean) {
  muted = value;
  if (muted) {
    queue.length = 0;
    current?.pause();
    current = null;
    playing = false;
  }
}

export function isMuted() {
  return muted;
}

let current: HTMLAudioElement | null = null;

function playNext() {
  if (playing || muted) return;
  const blob = queue.shift();
  if (!blob) return;
  playing = true;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  current = audio;
  const done = () => {
    URL.revokeObjectURL(url);
    current = null;
    playing = false;
    playNext();
  };
  audio.onended = done;
  audio.onerror = done;
  audio.play().catch(done); // 자동재생 정책 등으로 거부되면 조용히 다음으로
}

export async function speak(actor: string, text: string): Promise<void> {
  if (muted) return;
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
    queue.push(blob);
    while (queue.length > MAX_QUEUE) queue.shift(); // 오래된 것 드롭
    playNext();
  } catch {
    // 침묵 — 말풍선만으로 진행
  }
}
