import { describe, expect, it } from 'vitest';
import { describeSituation } from '../src/ai/situation';
import { createInitialState, reduce, type GameState } from '../src/game/state';
import { detectEvents } from '../src/game/events';
import type { YutThrow } from '../src/game/throwYut';

// STACK·FINISH는 CAPTURE와 달리 "한 번 더"가 항상 뒤따르지 않는다 (윷·모로 얻은 추가 턴 중에
// 일어났을 때만). 이 문맥이 빠지면 LLM이 상황을 오해해 뜬금없는 대사를 낸다 — 실사용 보고 사례.

const yut = (steps: 1 | 2 | 3 | 4 | 5, bonus = steps >= 4): YutThrow => ({
  sticks: [],
  name: (['do', 'gae', 'geol', 'yut', 'mo'] as const)[steps - 1],
  steps,
  bonus,
});

function setup(positions: Record<string, number>): GameState {
  const state = createInitialState(4);
  return { ...state, mals: state.mals.map((m) => (m.id in positions ? { ...m, pos: positions[m.id] } : m)) };
}

describe('describeSituation — STACK·FINISH의 추가 턴 문맥', () => {
  it('보너스 던지기(윷·모)로 업었으면 "한 번 더"를 언급한다', () => {
    let prev = setup({ 'blue-0': 2, 'blue-1': 6 });
    prev = reduce(prev, { type: 'THROW', yut: yut(4) }); // 윷 — bonus
    const move = { malIds: ['blue-0'], from: 2, to: 6, path: [3, 4, 5, 6], captures: [], stacks: ['blue-1'] };
    const action = { type: 'MOVE', move } as const;
    const next = reduce(prev, action);
    const [ev] = detectEvents(prev, action, next);
    expect(ev.type).toBe('STACK');
    expect(describeSituation(ev, next)).toContain('한 번 더');
  });

  it('평범한 던지기로 업었으면 "한 번 더"를 언급하지 않는다', () => {
    let prev = setup({ 'blue-0': 2, 'blue-1': 4 });
    prev = reduce(prev, { type: 'THROW', yut: yut(2, false) }); // 개 — no bonus
    const move = { malIds: ['blue-0'], from: 2, to: 4, path: [3, 4], captures: [], stacks: ['blue-1'] };
    const action = { type: 'MOVE', move } as const;
    const next = reduce(prev, action);
    const [ev] = detectEvents(prev, action, next);
    expect(ev.type).toBe('STACK');
    expect(describeSituation(ev, next)).not.toContain('한 번 더');
  });

  it('보너스 던지기로 완주했으면 FINISH도 "한 번 더"를 언급한다', () => {
    let prev = setup({ 'blue-0': 19 });
    prev = reduce(prev, { type: 'THROW', yut: yut(5) }); // 모 — bonus
    const move = { malIds: ['blue-0'], from: 19, to: 'goal' as const, path: [], captures: [], stacks: [] };
    const action = { type: 'MOVE', move } as const;
    const next = reduce(prev, action);
    const types = detectEvents(prev, action, next).map((e) => e.type);
    expect(types).toContain('FINISH');
    const finishEv = detectEvents(prev, action, next).find((e) => e.type === 'FINISH')!;
    expect(describeSituation(finishEv, next)).toContain('한 번 더');
  });
});
