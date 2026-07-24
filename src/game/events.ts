import { progressOf } from './board';
import { currentActor, currentTeam, type ActorId, type GameAction, type GameState, type TeamId } from './state';
import type { YutName } from './throwYut';

// 대사 트리거 이벤트 (CONCEPT §6.2). 매 턴이 아닌 이벤트 순간만 발화한다.
export type GameEventType =
  | 'GAME_START'
  | 'CAPTURE'
  | 'STACK'
  | 'YUT_MO'
  | 'FINISH'
  | 'LEAD_CHANGE'
  | 'GAME_END';

export interface GameEvent {
  type: GameEventType;
  /** 행동 주체 (해당 턴의 참가자) */
  actor: ActorId;
  team: TeamId;
  detail?: { capturedCount?: number; yutName?: YutName; winner?: TeamId; newLeader?: TeamId };
}

export function teamProgress(state: GameState, team: TeamId): number {
  return state.mals
    .filter((m) => m.team === team)
    .reduce((sum, m) => sum + progressOf(m.pos, m.shortcut), 0);
}

function leader(state: GameState): TeamId | null {
  const blue = teamProgress(state, 'blue');
  const orange = teamProgress(state, 'orange');
  if (blue === orange) return null;
  return blue > orange ? 'blue' : 'orange';
}

// 초반에는 매 이동마다 선두가 뒤집혀 역전 대사가 남발됨 →
// 새 선두의 진행도가 이 값 이상일 때만 LEAD_CHANGE 발화 (게임 후반 연출 — CONCEPT §6.2)
const LEAD_CHANGE_MIN_PROGRESS = 10;

/** 상태 전이(prev → action → next)에서 대사 트리거 이벤트를 판정한다 */
export function detectEvents(prev: GameState, action: GameAction, next: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const actor = currentActor(prev);
  const team = currentTeam(prev);

  if (action.type === 'THROW') {
    if (action.yut.bonus) {
      events.push({ type: 'YUT_MO', actor, team, detail: { yutName: action.yut.name } });
    }
    return events;
  }

  const { move } = action;
  if (move.captures.length > 0) {
    events.push({ type: 'CAPTURE', actor, team, detail: { capturedCount: move.captures.length } });
  } else if (move.stacks.length > 0) {
    events.push({ type: 'STACK', actor, team });
  }
  if (move.to === 'goal') {
    events.push({ type: 'FINISH', actor, team });
  }
  if (next.winner) {
    events.push({ type: 'GAME_END', actor, team, detail: { winner: next.winner } });
  } else {
    const prevLeader = leader(prev);
    const nextLeader = leader(next);
    if (
      nextLeader &&
      prevLeader &&
      nextLeader !== prevLeader &&
      teamProgress(next, nextLeader) >= LEAD_CHANGE_MIN_PROGRESS
    ) {
      events.push({ type: 'LEAD_CHANGE', actor, team, detail: { newLeader: nextLeader } });
    }
  }
  return events;
}
