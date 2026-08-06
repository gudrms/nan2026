import { describe, expect, it } from 'vitest';
import { endLines, hintFallback, linesForEvent, resultReactionLine, startLines, turnOpenLine } from '../src/ai/presetLines';
import type { DialogueLine, HintKind } from '../src/ai/presetLines';
import type { GameEventType } from '../src/game/events';
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

// 상대팀 대사 풀을 ev.actor에 통째로 붙이면 여울이 "어흥!", 범이가 "어머,"라고 말한다.
// 화자마다 고유 어휘가 있으므로, 남의 어휘가 섞였는지로 오배정을 전수 검사한다.
const SIGNATURES: Record<ActorId, string[]> = {
  beomtiger: ['어흥', '이 몸', '크하하', '어흐하하', '느냐'],
  ninetail: ['어머', '후후'],
  kkaki: ['깍깍', '대장'],
  player: [], // 플레이어는 대사가 없다 (까비가 대변)
};

function expectPersonaMatch(line: DialogueLine) {
  for (const [other, words] of Object.entries(SIGNATURES) as [ActorId, string[]][]) {
    if (other === line.actor) continue;
    for (const w of words) {
      expect(line.text, `${line.actor}의 대사 "${line.text}"에 ${other}의 어휘("${w}")가 있음`).not.toContain(w);
    }
  }
}

describe('presetLines — 화자·말투 일치 (대사 오배정 방지)', () => {
  const RNGS = [() => 0, () => 0.99];
  const EVENTS: GameEventType[] = ['GAME_START', 'CAPTURE', 'STACK', 'YUT_MO', 'FINISH', 'LEAD_CHANGE', 'GAME_END'];

  it('linesForEvent의 모든 이벤트·행동주체·분기에서 화자와 말투가 일치한다', () => {
    const cases: { actor: ActorId; team: 'blue' | 'orange' }[] = [
      { actor: 'player', team: 'blue' },
      { actor: 'kkaki', team: 'blue' },
      { actor: 'beomtiger', team: 'orange' },
      { actor: 'ninetail', team: 'orange' },
    ];
    for (const type of EVENTS) {
      for (const { actor, team } of cases) {
        for (const rng of RNGS) {
          for (const winner of ['blue', 'orange'] as const) {
            const lines = linesForEvent(
              { type, actor, team, detail: { yutName: 'yut', winner, newLeader: winner, capturedCount: 1 } },
              rng,
            );
            for (const line of lines) expectPersonaMatch(line);
          }
        }
      }
    }
  });

  it('행동 주체가 낸 이벤트의 첫 대사는 그 주체 본인이 말한다', () => {
    // GAME_START·LEAD_CHANGE·GAME_END는 판 전체 리액션이라 화자가 고정 — 행동 주체 대사만 검사
    for (const type of ['CAPTURE', 'STACK', 'YUT_MO', 'FINISH'] as GameEventType[]) {
      for (const actor of ['beomtiger', 'ninetail'] as ActorId[]) {
        for (const rng of RNGS) {
          const [first] = linesForEvent({ type, actor, team: 'orange', detail: { yutName: 'yut' } }, rng);
          expect(first.actor, `${type} / ${actor}`).toBe(actor);
        }
      }
    }
  });

  it('그 외 대사 생성기도 화자와 말투가 일치한다', () => {
    for (const rng of RNGS) {
      for (const line of startLines(rng)) expectPersonaMatch(line);
      for (const winner of ['blue', 'orange'] as const) {
        for (const line of endLines(winner, rng)) expectPersonaMatch(line);
      }
      for (const actor of ['kkaki', 'beomtiger', 'ninetail', 'player'] as ActorId[]) {
        expectPersonaMatch(turnOpenLine(actor, rng));
      }
      for (const actor of ['kkaki', 'beomtiger', 'ninetail'] as ActorId[]) {
        for (const name of ['do', 'gae', 'geol', 'yut', 'mo'] as YutName[]) {
          expectPersonaMatch(resultReactionLine(actor, name, rng));
        }
      }
      for (const kind of ['capture', 'goal', 'stack', 'shortcut', 'advance'] as HintKind[]) {
        expectPersonaMatch(hintFallback(kind, rng));
      }
    }
  });

  // 실사용 보고 사례 (여울이 완주 후 "먼저 한 발 완주다! 어흥!"이라고 말함)
  it('여울이 완주시키면 여울 말투로 말한다', () => {
    const [line] = linesForEvent({ type: 'FINISH', actor: 'ninetail', team: 'orange' }, () => 0);
    expect(line.actor).toBe('ninetail');
    expect(line.text).not.toContain('어흥');
  });
});
