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

// ---------------------------------------------------------------------------
// 판단 AI v2 — 기대값 탐색 (spec §4.2)
// 수를 실제로 적용한 결과 상태에서 (내 진행 이득 + 상대 손실)을 재고,
// 상대 다음 던지기의 확률분포(도~모)를 펼쳐 "최선의 반격 잡기"의 기대 손실을 뺀다.
// ---------------------------------------------------------------------------

/** 캐릭터별 성향 가중치 — 플레이 스타일에 성격 반영 (CONCEPT §4) */
export interface Personality {
  /** 잡기(상대 손실) 가치 배율 */
  aggression: number;
  /** 피격 기대 손실 배율 (높을수록 안전 주행) */
  caution: number;
}

export const PERSONALITIES: Record<string, Personality> = {
  balanced: { aggression: 1.0, caution: 1.0 },
  beomtiger: { aggression: 1.4, caution: 0.6 }, // 허세 대장 — 잡기 우선, 위험 감수
  ninetail: { aggression: 0.9, caution: 1.4 }, // 계산가 — 안전 주행
  kkaki: { aggression: 1.0, caution: 1.0 }, // 균형
};

/** 다음 상대 이동의 기대 손실: 던지기 분포를 펼쳐 각 결과에서 상대 최선의 잡기 손실 */
function expectedCaptureLoss(mals: Mal[], myTeam: TeamId): number {
  const probs = stepProbabilities();
  // 내 팀 말 위치별 진행도 합 (잡히면 잃는 가치)
  const myGroups = new Map<number, number>();
  for (const m of mals) {
    if (m.team !== myTeam || typeof m.pos !== 'number') continue;
    myGroups.set(m.pos, (myGroups.get(m.pos) ?? 0) + progressOf(m.pos, m.shortcut) + 2); // +2: 재출발 비용
  }
  if (myGroups.size === 0) return 0;

  const enemySeen = new Set<string>();
  const enemyGroups: { pos: number | 'ready'; sc: ShortcutState }[] = [];
  for (const m of mals) {
    if (m.team === myTeam || m.pos === 'goal') continue;
    const key = `${m.pos}`;
    if (enemySeen.has(key)) continue;
    enemySeen.add(key);
    enemyGroups.push({ pos: m.pos as number | 'ready', sc: m.shortcut });
  }

  let loss = 0;
  for (let steps = 1; steps <= 5; steps++) {
    let bestLossAtSteps = 0; // 상대는 이 던지기 결과에서 가장 큰 잡기를 고른다
    for (const g of enemyGroups) {
      const ahead = remainingPath(g.pos, g.sc);
      if (steps > ahead.length) continue;
      const dest = ahead[steps - 1];
      const captured = myGroups.get(dest);
      if (captured && captured > bestLossAtSteps) bestLossAtSteps = captured;
    }
    loss += probs[steps] * bestLossAtSteps;
  }
  return loss;
}

/** 수 적용 후의 말 배치 (턴 전환 없이 배치만) — 기대값 평가용 */
function applyMoveToMals(mals: Mal[], move: Move): Mal[] {
  const moved = new Set(move.malIds);
  const captured = new Set(move.captures);
  const stacked = new Set(move.stacks);
  const mover = mals.find((m) => m.id === move.malIds[0]) as Mal;
  const landedSc: ShortcutState =
    typeof move.to === 'number' ? nextShortcutState(move.to, mover.shortcut) : 'none';
  return mals.map((m): Mal => {
    if (moved.has(m.id)) return { ...m, pos: move.to === 'goal' ? 'goal' : move.to, shortcut: landedSc };
    if (captured.has(m.id)) return { ...m, pos: 'ready', shortcut: 'none' };
    if (stacked.has(m.id)) return { ...m, shortcut: landedSc };
    return m;
  });
}

function teamProgressOf(mals: Mal[], team: TeamId): number {
  return mals.filter((m) => m.team === team).reduce((s, m) => s + progressOf(m.pos, m.shortcut), 0);
}

export function scoreMoveExpecti(state: GameState, move: Move, p: Personality): number {
  const team = currentTeam(state);
  const enemyTeam: TeamId = team === 'blue' ? 'orange' : 'blue';
  const after = applyMoveToMals(state.mals, move);

  const myGain = teamProgressOf(after, team) - teamProgressOf(state.mals, team);
  const enemyLoss = teamProgressOf(state.mals, enemyTeam) - teamProgressOf(after, enemyTeam);
  const extraTurn = move.captures.length > 0 ? 2.55 : 0; // 추가 던지기 기대 전진량
  const risk = expectedCaptureLoss(after, team);

  return myGain + (enemyLoss + extraTurn) * p.aggression - risk * p.caution;
}

export function chooseMoveExpecti(
  state: GameState,
  moves: Move[],
  p: Personality = PERSONALITIES.balanced,
): Move {
  if (moves.length === 0) throw new Error('가능한 수가 없음');
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const s = scoreMoveExpecti(state, move, p);
    if (s > bestScore) {
      bestScore = s;
      best = move;
    }
  }
  return best;
}
