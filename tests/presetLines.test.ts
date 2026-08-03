import { describe, expect, it } from 'vitest';
import { resultReactionLine, linesForEvent } from '../src/ai/presetLines';
import type { YutName } from '../src/game/throwYut';
import type { ActorId } from '../src/game/state';

// 도개걸윷모에 붙는 조사는 받침 유무로 갈린다.
//   받침 없음(도·개·모): 예요 / 라니 / 다 / 네요 / 면
//   받침 있음(걸·윷):   이에요 / 이라니 / 이다 / 이네요 / 이면
// 조사를 하나씩 나열하면 새 대사를 추가할 때 또 빠지므로, 틀린 형태를 조합으로 생성해 전수 검사한다.
const PARTICLES = ['에요', '라니', '다', '네요', '면'];
const NO_BATCHIM = ['도', '개', '모'];

/** 해당 음절에 대해 "나오면 안 되는" 조사 형태 목록 */
function wrongForms(ko: string): string[] {
  // 받침 없는 말에 "이"를 끼우면 틀림(개이에요), 받침 있는 말은 "이"가 빠지면 틀림(윷다)
  return NO_BATCHIM.includes(ko) ? PARTICLES.map((p) => `${ko}이${p}`) : PARTICLES.map((p) => `${ko}${p}`);
}

const KO: Record<YutName, string> = { do: '도', gae: '개', geol: '걸', yut: '윷', mo: '모' };

function expectNoWrongParticle(text: string, name: YutName) {
  for (const bad of wrongForms(KO[name])) {
    expect(text, `"${text}"에 어색한 조사("${bad}")가 있음`).not.toContain(bad);
  }
}

// pick()이 배열 양쪽 원소를 다 고르도록 두 rng로 훑는다 (모든 풀이 2개짜리)
const RNGS = [() => 0, () => 0.99];

describe('presetLines — 도개걸윷모 조사 어법 (받침 유무)', () => {
  const names: YutName[] = ['do', 'gae', 'geol', 'yut', 'mo'];
  const actors: ActorId[] = ['kkaki', 'beomtiger', 'ninetail'];

  it('resultReactionLine의 모든 actor·yutName·분기 조합에 어색한 조사가 없다', () => {
    for (const name of names) {
      for (const actor of actors) {
        for (const rng of RNGS) {
          expectNoWrongParticle(resultReactionLine(actor, name, rng).text, name);
        }
      }
    }
  });

  it('YUT_MO 이벤트 대사에도 어색한 조사가 없다 (윷·모, 양 팀)', () => {
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

  // 실제 배포판에서 발견됐던 사례를 정확한 출력으로 고정 (회귀 방지)
  it('실사용 보고 사례가 올바른 형태로 나온다', () => {
    expect(resultReactionLine('ninetail', 'yut', () => 0).text).toBe('어머, 윷이네요. 후후.'); // was: 윷네요
    expect(resultReactionLine('ninetail', 'gae', () => 0.99).text).toBe('개면 충분해요.'); // was: 개이면
    expect(resultReactionLine('beomtiger', 'yut', () => 0.99).text).toBe('봤느냐! 윷이다!'); // was: 윷다
    expect(resultReactionLine('kkaki', 'gae', () => 0.99).text).toBe('개예요. 나쁘지 않아요!'); // was: 개이에요
  });
});
