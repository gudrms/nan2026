import { nextShortcutState, progressOf, remainingPath, type ShortcutState } from './board';
import { currentTeam, type GameState, type Mal, type Move, type TeamId } from './state';
import { stepProbabilities } from './throwYut';

// 판단 AI v1 — 휴리스틱: 잡기 > 완주 > 위험 회피 > 업기 > 전진 (spec §4.2의 1차 버전).
// M1 후반에 기대값 탐색(expectimax) v2로 교체하고 자동 대전 승률로 개선을 검증한다.

export interface BotWeights {
  capture: number;
  goal: number;
  danger: number;
  stack: number;
  advance: number;
}

export const DEFAULT_WEIGHTS: BotWeights = {
  capture: 1000,
  goal: 700,
  danger: 400,
  stack: 150,
  advance: 8,
};

/** pos에 있는 team 말이 다음 상대 이동에 잡힐 확률 (근사: 상대 각 그룹의 1~5스텝 도달 확률 합) */
export function dangerAt(state: GameState, pos: number, team: TeamId): number {
  const probs = stepProbabilities();
  let danger = 0;
  const seen = new Set<string>(); // 같은 칸 그룹·대기 말 중복 방지
  for (const enemy of state.mals) {
    if (enemy.team === team) continue;
    if (enemy.pos === 'goal') continue;
    const key = enemy.pos === 'ready' ? 'ready' : `${enemy.pos}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ahead = remainingPath(enemy.pos, enemy.shortcut).slice(0, 5);
    const idx = ahead.indexOf(pos);
    if (idx >= 0) danger += probs[idx + 1];
  }
  return Math.min(danger, 1);
}

export function scoreMove(state: GameState, move: Move, w: BotWeights = DEFAULT_WEIGHTS): number {
  const team = currentTeam(state);
  const mover = state.mals.find((m) => m.id === move.malIds[0]) as Mal;
  let s = 0;

  s += move.captures.length * w.capture;
  s += move.stacks.length * w.stack;

  if (move.to === 'goal') {
    s += w.goal * move.malIds.length; // 업힌 그룹 완주는 말 수만큼 가치
    // 완주는 위험 없음 — 이탈로 원래 자리의 위험도 해소
    if (typeof move.from === 'number') s += dangerAt(state, move.from, team) * w.danger;
    return s;
  }

  const sc: ShortcutState = nextShortcutState(move.to, mover.shortcut);
  // 전진 가치: 앞서 있는 말을 미는 성향 (지름길 진입 이득은 progressOf에 자연 반영)
  s += progressOf(move.to, sc) * w.advance;
  // 도착 칸의 피격 위험 (그룹이 클수록 잡혔을 때 손실 큼)
  s -= dangerAt(state, move.to, team) * w.danger * (move.malIds.length + move.stacks.length);
  // 원래 자리의 위험 해소
  if (typeof move.from === 'number') {
    s += dangerAt(state, move.from, team) * w.danger * move.malIds.length * 0.8;
  }
  return s;
}

export function chooseMove(state: GameState, moves: Move[], w: BotWeights = DEFAULT_WEIGHTS): Move {
  if (moves.length === 0) throw new Error('가능한 수가 없음');
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const s = scoreMove(state, move, w);
    if (s > bestScore) {
      bestScore = s;
      best = move;
    }
  }
  return best;
}
