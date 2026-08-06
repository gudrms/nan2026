import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 게임 화면을 벗어나도 TTS 큐는 모듈 전역이라 살아남는다 → 승리 후 결과 화면 위로
// 이전 판의 음성이 계속 재생되던 문제. stopSpeech()가 그 경로를 전부 끊는지 검증한다.

class FakeAudio {
  static instances: FakeAudio[] = [];
  playbackRate = 1;
  duration = 1;
  paused = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }
  play() {
    this.onplaying?.();
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

const audioResponse = () =>
  new Response(new Blob([new Uint8Array([1, 2, 3])]), {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
  });

/** 마이크로태스크(fetch→blob→큐 투입)가 전부 정착할 때까지 */
const settle = () => new Promise((r) => setTimeout(r, 0));

async function loadTts() {
  vi.resetModules(); // 모듈 전역 큐·epoch을 테스트마다 초기화
  return import('../src/ai/ttsClient');
}

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ttsClient — stopSpeech (화면 이탈 시 음성 정리)', () => {
  it('재생 중인 음성을 멈추고 대기 중인 음성을 버린다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(audioResponse())));
    const { speak, stopSpeech } = await loadTts();

    const first = speak('kkaki', '첫 줄');
    const second = speak('beomtiger', '둘째 줄');
    await settle();
    expect(FakeAudio.instances).toHaveLength(1); // 순차 재생 — 둘째는 대기 중

    stopSpeech();
    await expect(Promise.all([first, second])).resolves.toBeDefined(); // 둘 다 resolve (발화 체인 잠금 방지)
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(FakeAudio.instances).toHaveLength(1); // 대기분이 이어서 재생되지 않는다
  });

  it('중단 시점에 합성 대기 중이던 음성은 응답이 늦게 와도 재생하지 않는다', async () => {
    let release!: (res: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((res) => (release = res))));
    const { speak, stopSpeech } = await loadTts();

    const pending = speak('ninetail', '늦게 도착하는 음성');
    stopSpeech(); // 화면 이탈 — 아직 /api/tts 응답 전
    release(audioResponse());

    await expect(pending).resolves.toBeUndefined();
    await settle();
    expect(FakeAudio.instances).toHaveLength(0); // 결과 화면 위에서 되살아나지 않는다
  });

  it('중단 후에도 새 판의 음성은 정상 재생된다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(audioResponse())));
    const { speak, stopSpeech } = await loadTts();

    void speak('kkaki', '이전 판');
    await settle();
    stopSpeech();

    void speak('kkaki', '새 판');
    await settle();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].paused).toBe(false);
  });
});
