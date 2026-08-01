import { describe, expect, it } from 'vitest';
import { resultReactionLine, linesForEvent } from '../src/ai/presetLines';
import type { YutName } from '../src/game/throwYut';
import type { ActorId } from '../src/game/state';

// 도·개·모는 받침 없음(예요/라니/다), 걸·윷은 받침 있음(이에요/이라니/이다).
// pick()이 배열 양쪽 원소를 다 고르도록 두 rng로 훑는다 (모든 풀이 2개짜리).
const RNGS = [() => 0, () => 0.99];

// "걸이다"/"윷이다"는 "걸다"/"윷다"를 부분 문자열로 포함하지 않으므로 단순 포함 검사로 충분하다.
const WRONG_SUBSTRINGS: Record<string, string[]> = {
  do: ['도이에요', '도이라니', '도이다'],
  gae: ['개이에요', '개이라니', '개이다'],
  mo: ['모이에요', '모이라니', '모이다'],
  geol: ['걸라니', '걸에요', '걸다'],
  yut: ['윷라니', '윷에요', '윷다'],
};

function expectNoWrongParticle(text: string, name: YutName) {
  for (const bad of WRONG_SUBSTRINGS[name]) {
    expect(text, `"${text}"에 어색한 조사("${bad}")가 있음`).not.toContain(bad);
  }
}

describe('presetLines — 도개걸윷모 조사(이에요/예요, 라니/이라니, 다/이다) 어법', () => {
  const names: YutName[] = ['do', 'gae', 'geol', 'yut', 'mo'];
  const actors: ActorId[] = ['kkaki', 'beomtiger', 'ninetail'];

  it('resultReactionLine의 모든 grade·actor·yutName 조합에 어색한 조사가 없다', () => {
    for (const name of names) {
      for (const actor of actors) {
        for (const rng of RNGS) {
          const line = resultReactionLine(actor, name, rng);
          expectNoWrongParticle(line.text, name);
        }
      }
    }
  });

  it('YUT_MO 이벤트 축하·견제 대사에도 어색한 조사가 없다 (윷·모만 발생, 양 팀)', () => {
    for (const name of ['yut', 'mo'] as YutName[]) {
      for (const team of ['blue', 'orange'] as const) {
        for (const rng of RNGS) {
          const lines = linesForEvent(
            { type: 'YUT_MO', actor: team === 'blue' ? 'player' : 'beomtiger', team, detail: { yutName: name } },
            rng,
          );
          for (const line of lines) expectNoWrongParticle(line.text, name);
        }
      }
    }
  });
});
