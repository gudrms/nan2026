import { describe, expect, it } from 'vitest';
import { resultReactionLine, linesForEvent } from '../src/ai/presetLines';
import type { YutName } from '../src/game/throwYut';
import type { ActorId } from '../src/game/state';

// 도·개·모는 받침 없음(예요/라니), 걸·윷은 받침 있음(이에요/이라니).
// pick()이 배열 양쪽 원소를 다 고르도록 두 rng로 훑는다 (모든 풀이 2개짜리).
const RNGS = [() => 0, () => 0.99];

const WRONG_PATTERNS: Record<string, RegExp> = {
  do: /도이에요|도이라니/,
  gae: /개이에요|개이라니/,
  mo: /모이에요|모이라니/,
  geol: /걸(?<!이)라니|걸(?<!이)에요/, // "걸라니"·"걸에요"(이 없이)는 오류
  yut: /윷(?<!이)라니|윷(?<!이)에요/,
};

describe('presetLines — 도개걸윷모 조사(이에요/예요, 라니/이라니) 어법', () => {
  const names: YutName[] = ['do', 'gae', 'geol', 'yut', 'mo'];
  const actors: ActorId[] = ['kkaki', 'beomtiger', 'ninetail'];

  it('resultReactionLine의 모든 grade·actor·yutName 조합에 어색한 조사가 없다', () => {
    for (const name of names) {
      for (const actor of actors) {
        for (const rng of RNGS) {
          const line = resultReactionLine(actor, name, rng);
          expect(line.text).not.toMatch(WRONG_PATTERNS[name]);
        }
      }
    }
  });

  it('YUT_MO 이벤트 축하 대사에도 어색한 조사가 없다 (윷·모만 발생)', () => {
    for (const name of ['yut', 'mo'] as YutName[]) {
      for (const rng of RNGS) {
        const lines = linesForEvent(
          { type: 'YUT_MO', actor: 'player', team: 'blue', detail: { yutName: name } },
          rng,
        );
        for (const line of lines) expect(line.text).not.toMatch(WRONG_PATTERNS[name]);
      }
    }
  });
});
