import { describe, expect, it } from 'vitest';
import { createInitialState, currentActor, reduce, type GameState, type Move } from '../src/game/state';
import { getMoves } from '../src/game/rules';
import type { YutThrow } from '../src/game/throwYut';

const yut = (steps: 1 | 2 | 3 | 4 | 5, bonus = steps >= 4): YutThrow => ({
  sticks: [],
  name: (['do', 'gae', 'geol', 'yut', 'mo'] as const)[steps - 1],
  steps,
  bonus,
});

/** 말 위치를 강제로 배치한 상태 생성 (테스트 헬퍼) */
function setup(
  positions: Partial<Record<string, { pos: number | 'ready' | 'goal'; shortcut?: GameState['mals'][0]['shortcut'] }>>,
  turnIdx = 0,
): GameState {
  const state = createInitialState(4);
  return {
    ...state,
    turnIdx,
    mals: state.mals.map((m) =>
      positions[m.id] ? { ...m, pos: positions[m.id]!.pos, shortcut: positions[m.id]!.shortcut ?? 'none' } : m,
    ),
  };
}

function move(state: GameState, pick: (moves: Move[]) => Move | undefined): { next: GameState; chosen: Move } {
  const moves = getMoves(state);
  const chosen = pick(moves);
  if (!chosen) throw new Error(`조건에 맞는 수 없음: ${JSON.stringify(moves)}`);
  return { next: reduce(state, { type: 'MOVE', move: chosen }), chosen };
}

describe('getMoves', () => {
  it('초기 상태에서 도(1)면 새 말 투입 수 하나뿐', () => {
    const state = reduce(createInitialState(4), { type: 'THROW', yut: yut(1) });
    const moves = getMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0].from).toBe('ready');
    expect(moves[0].to).toBe(1);
  });

  it('판 위 그룹별 + 투입 수가 각각 나온다', () => {
    let state = setup({ 'blue-0': { pos: 3 }, 'blue-1': { pos: 7 } });
    state = reduce(state, { type: 'THROW', yut: yut(2) });
    const moves = getMoves(state);
    expect(moves).toHaveLength(3); // 3→5, 7→9, ready→2
  });

  it('업힌 그룹은 하나의 수로 묶인다', () => {
    let state = setup({ 'blue-0': { pos: 6 }, 'blue-1': { pos: 6 } });
    state = reduce(state, { type: 'THROW', yut: yut(3) });
    const grouped = getMoves(state).find((m) => m.from === 6);
    expect(grouped?.malIds.sort()).toEqual(['blue-0', 'blue-1']);
  });
});

describe('잡기', () => {
  it('상대 말 칸 도착 → 상대는 대기로, 잡은 팀이 한 번 더', () => {
    let state = setup({ 'blue-0': { pos: 2 }, 'orange-0': { pos: 5 } });
    state = reduce(state, { type: 'THROW', yut: yut(3, false) });
    const { next, chosen } = move(state, (ms) => ms.find((m) => m.captures.length > 0));
    expect(chosen.to).toBe(5);
    expect(next.mals.find((m) => m.id === 'orange-0')?.pos).toBe('ready');
    expect(next.phase).toBe('awaitingThrow');
    expect(currentActor(next)).toBe('player'); // 추가 턴
  });

  it('업힌 그룹을 잡으면 전부 대기로 돌아간다', () => {
    let state = setup({ 'blue-0': { pos: 2 }, 'orange-0': { pos: 4 }, 'orange-1': { pos: 4 } });
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const { next, chosen } = move(state, (ms) => ms.find((m) => m.captures.length > 0));
    expect(chosen.captures.sort()).toEqual(['orange-0', 'orange-1']);
    expect(next.mals.filter((m) => m.team === 'orange' && m.pos === 'ready')).toHaveLength(4);
  });
});

describe('업기', () => {
  it('아군 말 칸 도착 → 업고 함께 이동', () => {
    let state = setup({ 'blue-0': { pos: 2 }, 'blue-1': { pos: 4 } });
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const { next, chosen } = move(state, (ms) => ms.find((m) => m.stacks.length > 0));
    expect(chosen.stacks).toEqual(['blue-1']);
    // 다음 이동에서 그룹으로 묶이는지
    const after = reduce(next, { type: 'THROW', yut: yut(2, false) });
    // 턴이 넘어갔으므로 blue 차례가 아님 — blue 차례로 되돌려 확인
    const blueTurn = { ...after, turnIdx: 0 };
    const grouped = getMoves(blueTurn).find((m) => m.from === 4);
    expect(grouped?.malIds.sort()).toEqual(['blue-0', 'blue-1']);
  });

  it('업기 시 기존 말의 경로 상태가 도착 그룹 기준으로 통일된다', () => {
    let state = setup({
      'blue-0': { pos: 20, shortcut: 'from5' },
      'blue-1': { pos: 22, shortcut: 'centerExit' },
    });
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const { next } = move(state, (ms) => ms.find((m) => m.from === 20));
    // 20에서 2스텝 → 22(방) 도착, from5 → centerExit 전환. 기존 말도 통일
    for (const id of ['blue-0', 'blue-1']) {
      const mal = next.mals.find((m) => m.id === id)!;
      expect(mal.pos).toBe(22);
      expect(mal.shortcut).toBe('centerExit');
    }
  });
});

describe('추가 턴·턴 순서', () => {
  it('윷·모는 이동 후 같은 참가자가 다시 던진다', () => {
    let state = createInitialState(4);
    state = reduce(state, { type: 'THROW', yut: yut(4) });
    const { next } = move(state, (ms) => ms[0]);
    expect(currentActor(next)).toBe('player');
  });

  it('일반 결과는 다음 참가자로 넘어간다 (player → beomtiger)', () => {
    let state = createInitialState(4);
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const { next } = move(state, (ms) => ms[0]);
    expect(currentActor(next)).toBe('beomtiger');
  });
});

describe('지름길 진입·통과', () => {
  it('모서리 5 정지 → 다음 이동은 대각선으로', () => {
    let state = setup({ 'blue-0': { pos: 3 } });
    state = reduce(state, { type: 'THROW', yut: yut(2, false) });
    const { next } = move(state, (ms) => ms.find((m) => m.from === 3));
    expect(next.mals.find((m) => m.id === 'blue-0')?.shortcut).toBe('from5');

    let again = { ...next, turnIdx: 0 };
    again = reduce(again, { type: 'THROW', yut: yut(3, false) });
    const r2 = move(again, (ms) => ms.find((m) => m.from === 5));
    expect(r2.chosen.to).toBe(22); // 5 → 20 → 21 → 22(방)
    expect(r2.next.mals.find((m) => m.id === 'blue-0')?.shortcut).toBe('centerExit');
  });

  it('방(22) 최단 출구에서 4스텝(윷)이면 완주한다', () => {
    let state = setup({ 'blue-0': { pos: 22, shortcut: 'centerExit' } });
    state = reduce(state, { type: 'THROW', yut: yut(4) });
    const { next } = move(state, (ms) => ms.find((m) => m.from === 22));
    expect(next.mals.find((m) => m.id === 'blue-0')?.pos).toBe('goal');
  });
});

describe('완주·승리', () => {
  it('마지막 말이 완주하면 즉시 게임 종료', () => {
    let state = setup({
      'blue-0': { pos: 'goal' },
      'blue-1': { pos: 'goal' },
      'blue-2': { pos: 'goal' },
      'blue-3': { pos: 0 },
    });
    state = reduce(state, { type: 'THROW', yut: yut(1) });
    const { next } = move(state, (ms) => ms.find((m) => m.to === 'goal'));
    expect(next.phase).toBe('finished');
    expect(next.winner).toBe('blue');
  });
});
