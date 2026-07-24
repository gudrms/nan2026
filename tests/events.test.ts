import { describe, expect, it } from 'vitest';
import { createInitialState, reduce, type GameState } from '../src/game/state';
import { getMoves } from '../src/game/rules';
import { detectEvents, teamProgress } from '../src/game/events';
import type { YutThrow } from '../src/game/throwYut';

const yut = (steps: 1 | 2 | 3 | 4 | 5, bonus = steps >= 4): YutThrow => ({
  sticks: [],
  name: (['do', 'gae', 'geol', 'yut', 'mo'] as const)[steps - 1],
  steps,
  bonus,
});

function setup(
  positions: Partial<Record<string, { pos: number | 'ready' | 'goal'; shortcut?: GameState['mals'][0]['shortcut'] }>>,
): GameState {
  const state = createInitialState(4);
  return {
    ...state,
    mals: state.mals.map((m) =>
      positions[m.id] ? { ...m, pos: positions[m.id]!.pos, shortcut: positions[m.id]!.shortcut ?? 'none' } : m,
    ),
  };
}

describe('detectEvents', () => {
  it('윷·모 던지기 → YUT_MO (던진 주체 기준)', () => {
    const prev = createInitialState(4);
    const action = { type: 'THROW', yut: yut(5) } as const;
    const next = reduce(prev, action);
    const events = detectEvents(prev, action, next);
    expect(events).toEqual([
      { type: 'YUT_MO', actor: 'player', team: 'blue', detail: { yutName: 'mo' } },
    ]);
  });

  it('잡기 → CAPTURE + 후반 리드가 뒤집히면 LEAD_CHANGE 동시 발생', () => {
    // orange가 16까지 앞서 있고 blue가 14에서 개(2)로 16을 잡으면 리드 역전 (새 선두 진행도 16 ≥ 문턱 10)
    let prev = setup({ 'blue-0': { pos: 14 }, 'orange-0': { pos: 16 } });
    prev = reduce(prev, { type: 'THROW', yut: yut(2, false) });
    const capture = getMoves(prev).find((m) => m.captures.length > 0)!;
    const action = { type: 'MOVE', move: capture } as const;
    const next = reduce(prev, action);
    const types = detectEvents(prev, action, next).map((e) => e.type);
    expect(types).toContain('CAPTURE');
    expect(types).toContain('LEAD_CHANGE');
  });

  it('초반 선두 교체는 LEAD_CHANGE를 내지 않는다 (진행도 문턱 미달)', () => {
    let prev = setup({ 'blue-0': { pos: 3 }, 'orange-0': { pos: 4 } });
    prev = reduce(prev, { type: 'THROW', yut: yut(2, false) });
    const plain = getMoves(prev).find((m) => m.from === 3)!; // 3→5, blue 5 > orange 4로 역전이지만 초반
    const action = { type: 'MOVE', move: plain } as const;
    const types = detectEvents(prev, action, reduce(prev, action)).map((e) => e.type);
    expect(types).not.toContain('LEAD_CHANGE');
  });

  it('업기 → STACK (잡기가 없을 때만)', () => {
    let prev = setup({ 'blue-0': { pos: 2 }, 'blue-1': { pos: 4 } });
    prev = reduce(prev, { type: 'THROW', yut: yut(2, false) });
    const stack = getMoves(prev).find((m) => m.stacks.length > 0)!;
    const action = { type: 'MOVE', move: stack } as const;
    const events = detectEvents(prev, action, reduce(prev, action));
    expect(events.map((e) => e.type)).toEqual(['STACK']);
  });

  it('완주 → FINISH, 마지막 말이면 GAME_END까지', () => {
    let prev = setup({
      'blue-0': { pos: 'goal' },
      'blue-1': { pos: 'goal' },
      'blue-2': { pos: 'goal' },
      'blue-3': { pos: 0 },
    });
    prev = reduce(prev, { type: 'THROW', yut: yut(1) });
    const finish = getMoves(prev).find((m) => m.to === 'goal')!;
    const action = { type: 'MOVE', move: finish } as const;
    const next = reduce(prev, action);
    const types = detectEvents(prev, action, next).map((e) => e.type);
    expect(types).toContain('FINISH');
    expect(types).toContain('GAME_END');
  });

  it('평범한 이동은 이벤트 없음 (매 턴 대사 발화 방지)', () => {
    let prev = createInitialState(4);
    prev = reduce(prev, { type: 'THROW', yut: yut(2, false) });
    const plain = getMoves(prev)[0];
    const action = { type: 'MOVE', move: plain } as const;
    expect(detectEvents(prev, action, reduce(prev, action))).toEqual([]);
  });
});

describe('teamProgress', () => {
  it('완주 말과 전진 말이 진행도에 반영된다', () => {
    const state = setup({ 'blue-0': { pos: 'goal' }, 'orange-0': { pos: 3 } });
    expect(teamProgress(state, 'blue')).toBe(21);
    expect(teamProgress(state, 'orange')).toBe(3);
  });
});
