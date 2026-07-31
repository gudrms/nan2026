import { describe, expect, it } from 'vitest';
import { createInitialState, reduce, type GameState } from '../src/game/state';
import { getMoves } from '../src/game/rules';
import { chooseMove, chooseMoveExpecti, dangerAt, scoreMove, scoreMoveExpecti, PERSONALITIES } from '../src/game/botAI';
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

describe('dangerAt', () => {
  it('상대가 뒤에서 1~5스텝 거리면 해당 스텝 확률만큼 위험', () => {
    // 나머지 orange는 goal로 치워 투입 사정권 간섭 제거
    const state = setup({
      'orange-0': { pos: 1 },
      'orange-1': { pos: 'goal' },
      'orange-2': { pos: 'goal' },
      'orange-3': { pos: 'goal' },
    });
    // orange가 1에 있을 때: 3은 2스텝(개 34.56%), 6은 5스텝(모 2.56%), 7은 사정권 밖
    expect(dangerAt(state, 3, 'blue')).toBeCloseTo(0.3456, 3);
    expect(dangerAt(state, 6, 'blue')).toBeCloseTo(0.0256, 3);
    expect(dangerAt(state, 7, 'blue')).toBe(0);
  });

  it('대기 말도 투입 사정권(1~5)을 위협한다', () => {
    const state = createInitialState(4); // orange 전원 대기
    expect(dangerAt(state, 3, 'blue')).toBeGreaterThan(0);
    expect(dangerAt(state, 6, 'blue')).toBe(0);
  });
});

describe('scoreMove', () => {
  it('같은 이동이라도 도착 칸이 위험하면 점수가 낮다', () => {
    const base = setup({ 'blue-0': { pos: 11 } });
    const safe = reduce(base, { type: 'THROW', yut: yut(2, false) });
    const safeMove = getMoves(safe).find((m) => m.from === 11)!;

    const threatened = setup({ 'blue-0': { pos: 11 }, 'orange-0': { pos: 12 } });
    const risky = reduce(threatened, { type: 'THROW', yut: yut(2, false) });
    const riskyMove = getMoves(risky).find((m) => m.from === 11)!;

    expect(scoreMove(risky, riskyMove)).toBeLessThan(scoreMove(safe, safeMove));
  });
});

describe('chooseMove — 휴리스틱 우선순위', () => {
  it('잡을 수 있으면 잡는다', () => {
    let state = setup({ 'blue-0': { pos: 2 }, 'blue-1': { pos: 12 }, 'orange-0': { pos: 4 } });
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const chosen = chooseMove(state, getMoves(state));
    expect(chosen.captures).toContain('orange-0');
  });

  it('완주 가능한 말이 있으면 완주를 우선한다', () => {
    let state = setup({ 'blue-0': { pos: 0 }, 'blue-1': { pos: 8 } });
    state = reduce(state, { type: 'THROW', yut: yut(3, false) });
    const chosen = chooseMove(state, getMoves(state));
    expect(chosen.to).toBe('goal');
  });
});

describe('chooseMoveExpecti — 기대값 탐색 v2', () => {
  it('잡을 수 있으면 잡는다 (상대 손실 + 추가 턴 기대값)', () => {
    let state = setup({ 'blue-0': { pos: 2 }, 'blue-1': { pos: 12 }, 'orange-0': { pos: 4 } });
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const chosen = chooseMoveExpecti(state, getMoves(state));
    expect(chosen.captures).toContain('orange-0');
  });

  it('같은 수라도 상대 사정권에 두는 배치는 점수가 낮다', () => {
    const safeState = setup({ 'blue-0': { pos: 11 } });
    const safe = reduce(safeState, { type: 'THROW', yut: yut(2, false) });
    const safeMove = getMoves(safe).find((m) => m.from === 11)!;

    const riskyState = setup({ 'blue-0': { pos: 11 }, 'orange-0': { pos: 12 } });
    const risky = reduce(riskyState, { type: 'THROW', yut: yut(2, false) });
    const riskyMove = getMoves(risky).find((m) => m.from === 11)!;

    const p = PERSONALITIES.balanced;
    expect(scoreMoveExpecti(risky, riskyMove, p)).toBeLessThan(scoreMoveExpecti(safe, safeMove, p));
  });

  it('성향 가중치: 같은 잡기 수를 범이(공격형)가 더 높게 평가한다', () => {
    let state = setup({ 'blue-0': { pos: 2 }, 'orange-0': { pos: 4 } });
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const capture = getMoves(state).find((m) => m.captures.length > 0)!;
    expect(scoreMoveExpecti(state, capture, PERSONALITIES.beomtiger)).toBeGreaterThan(
      scoreMoveExpecti(state, capture, PERSONALITIES.ninetail),
    );
  });
});
