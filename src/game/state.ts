import { nextShortcutState, type ShortcutState } from './board';
import type { YutThrow } from './throwYut';

export type TeamId = 'blue' | 'orange';
export type ActorId = 'player' | 'kkaki' | 'beomtiger' | 'ninetail';

export const ACTOR_TEAM: Record<ActorId, TeamId> = {
  player: 'blue',
  kkaki: 'blue',
  beomtiger: 'orange',
  ninetail: 'orange',
};

/** 팀 교대 순서: 아군-적-아군-적. 팀의 말은 팀원이 공유한다 */
export const TURN_ORDER: ActorId[] = ['player', 'beomtiger', 'kkaki', 'ninetail'];

export type MalPos = number | 'ready' | 'goal';

export interface Mal {
  id: string;
  team: TeamId;
  pos: MalPos;
  shortcut: ShortcutState;
}

export interface Move {
  /** 함께 움직이는 말들 (업힌 그룹 전체) */
  malIds: string[];
  from: number | 'ready';
  to: number | 'goal';
  /** 지나는 노드 목록 (연출용) */
  path: number[];
  /** 도착 칸에서 잡히는 상대 말 id */
  captures: string[];
  /** 도착 칸에 이미 있던 아군 말 id (업기) */
  stacks: string[];
}

export type Phase = 'awaitingThrow' | 'awaitingMove' | 'finished';

export interface GameState {
  phase: Phase;
  mals: Mal[];
  turnIdx: number; // TURN_ORDER 인덱스
  pendingThrow: YutThrow | null;
  winner: TeamId | null;
  moveCount: number;
}

export type GameAction = { type: 'THROW'; yut: YutThrow } | { type: 'MOVE'; move: Move };

export function createInitialState(malsPerTeam = 4): GameState {
  const mals: Mal[] = [];
  for (const team of ['blue', 'orange'] as TeamId[]) {
    for (let i = 0; i < malsPerTeam; i++) {
      mals.push({ id: `${team}-${i}`, team, pos: 'ready', shortcut: 'none' });
    }
  }
  return { phase: 'awaitingThrow', mals, turnIdx: 0, pendingThrow: null, winner: null, moveCount: 0 };
}

export function currentActor(state: GameState): ActorId {
  return TURN_ORDER[state.turnIdx];
}

export function currentTeam(state: GameState): TeamId {
  return ACTOR_TEAM[currentActor(state)];
}

export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'THROW': {
      if (state.phase !== 'awaitingThrow') throw new Error(`THROW 불가: phase=${state.phase}`);
      return { ...state, phase: 'awaitingMove', pendingThrow: action.yut };
    }
    case 'MOVE': {
      if (state.phase !== 'awaitingMove' || !state.pendingThrow) {
        throw new Error(`MOVE 불가: phase=${state.phase}`);
      }
      const { move } = action;
      const movedSet = new Set(move.malIds);
      const capturedSet = new Set(move.captures);
      const stackedSet = new Set(move.stacks);

      const mover = state.mals.find((m) => m.id === move.malIds[0]);
      if (!mover) throw new Error(`말 없음: ${move.malIds[0]}`);
      const landedShortcut: ShortcutState =
        typeof move.to === 'number' ? nextShortcutState(move.to, mover.shortcut) : 'none';

      const mals = state.mals.map((m): Mal => {
        if (movedSet.has(m.id)) {
          return { ...m, pos: move.to === 'goal' ? 'goal' : move.to, shortcut: landedShortcut };
        }
        if (capturedSet.has(m.id)) {
          return { ...m, pos: 'ready', shortcut: 'none' };
        }
        // 업힌 기존 말은 새로 도착한 그룹의 경로 상태로 통일 (보류 결정 D-4)
        if (stackedSet.has(m.id)) {
          return { ...m, shortcut: landedShortcut };
        }
        return m;
      });

      const team = currentTeam(state);
      const won = mals.filter((m) => m.team === team).every((m) => m.pos === 'goal');
      if (won) {
        return { ...state, mals, phase: 'finished', winner: team, pendingThrow: null, moveCount: state.moveCount + 1 };
      }

      // 윷·모 또는 잡기 → 같은 팀원이 한 번 더 (중복이어도 1회 — 보류 결정 D-3)
      const extra = state.pendingThrow.bonus || move.captures.length > 0;
      return {
        ...state,
        mals,
        phase: 'awaitingThrow',
        pendingThrow: null,
        moveCount: state.moveCount + 1,
        turnIdx: extra ? state.turnIdx : (state.turnIdx + 1) % TURN_ORDER.length,
      };
    }
  }
}
