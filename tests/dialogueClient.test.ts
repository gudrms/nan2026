import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestLine } from '../src/ai/dialogueClient';
import type { DialogueLine } from '../src/ai/presetLines';

const FALLBACK: DialogueLine = { actor: 'kkaki', text: '폴백 대사예요!', emotion: 'joy' };
const REQ = { actor: 'kkaki', event: 'CAPTURE', situation: '테스트 상황', history: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dialogueClient — 폴백 경로 (게임 논블로킹 보장)', () => {
  it('네트워크 실패 시 프리셋 폴백을 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await requestLine(REQ, FALLBACK)).toEqual(FALLBACK);
  });

  it('서버 오류(503/키 없음)에도 폴백을 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    expect(await requestLine(REQ, FALLBACK)).toEqual(FALLBACK);
  });

  it('빈 텍스트·깨진 응답에도 폴백을 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '' }), { status: 200 })));
    expect(await requestLine(REQ, FALLBACK)).toEqual(FALLBACK);
  });

  it('정상 응답이면 LLM 대사를 사용한다 (emotion 검증 포함)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: '어흥! 접수한다!', emotion: 'joy' }), { status: 200 }),
      ),
    );
    const line = await requestLine(REQ, FALLBACK);
    expect(line).toEqual({ actor: 'kkaki', text: '어흥! 접수한다!', emotion: 'joy' });
  });

  it('알 수 없는 emotion 값은 폴백 emotion으로 보정한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: '대사', emotion: 'rage!!' }), { status: 200 }),
      ),
    );
    const line = await requestLine(REQ, FALLBACK);
    expect(line.emotion).toBe('joy');
  });

  it('헤더는 받았지만 본문 스트리밍이 멈춰도 타임아웃 후 폴백한다 (턴 드라이버 영구 정지 방지)', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const hangingRes = {
      ok: true,
      // 실제 fetch에서 헤더 수신 후 본문 스트림이 멈추는 상황 재현: json()이 abort 전까지 절대 안 끝남
      json: () =>
        new Promise((_resolve, reject) => {
          capturedSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts?: RequestInit) => {
        capturedSignal = opts?.signal ?? undefined;
        return Promise.resolve(hangingRes as unknown as Response);
      }),
    );
    const promise = requestLine(REQ, FALLBACK);
    await vi.advanceTimersByTimeAsync(3100); // TIMEOUT_MS(3000) 경과
    await expect(promise).resolves.toEqual(FALLBACK);
    vi.useRealTimers();
  });
});
