import { computeMove } from './board';
import { currentTeam, type GameState, type Mal, type Move, type TeamId } from './state';

/**
 * 현재 던지기 결과로 가능한 수 목록.
 * 같은 칸의 아군 말(업힌 그룹)은 하나의 수로 묶이고, 대기 말은 몇 개든 "새 말 투입" 수 하나다.
 * 빽도가 없으므로(MVP) 말이 하나라도 남아 있으면 가능한 수가 항상 존재한다.
 */
export function getMoves(state: GameState): Move[] {
  if (state.phase !== 'awaitingMove' || !state.pendingThrow) return [];
  const team = currentTeam(state);
  const steps = state.pendingThrow.steps;
  const own = state.mals.filter((m) => m.team === team);
  const moves: Move[] = [];

  const byPos = new Map<number, Mal[]>();
  for (const m of own) {
    if (typeof m.pos !== 'number') continue;
    const group = byPos.get(m.pos) ?? [];
    group.push(m);
    byPos.set(m.pos, group);
  }
  for (const [pos, group] of byPos) {
    const { dest, path } = computeMove(pos, group[0].shortcut, steps);
    moves.push(buildMove(state, team, group.map((g) => g.id), pos, dest, path));
  }

  const ready = own.find((m) => m.pos === 'ready');
  if (ready) {
    const { dest, path } = computeMove('ready', 'none', steps);
    moves.push(buildMove(state, team, [ready.id], 'ready', dest, path));
  }
  return moves;
}

function buildMove(
  state: GameState,
  team: TeamId,
  malIds: string[],
  from: number | 'ready',
  dest: number | 'goal',
  path: number[],
): Move {
  const captures =
    dest === 'goal' ? [] : state.mals.filter((m) => m.team !== team && m.pos === dest).map((m) => m.id);
  const stacks =
    dest === 'goal'
      ? []
      : state.mals
          .filter((m) => m.team === team && m.pos === dest && !malIds.includes(m.id))
          .map((m) => m.id);
  return { malIds, from, to: dest, path, captures, stacks };
}
