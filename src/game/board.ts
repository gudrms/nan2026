// 전통 윷판 29노드 그래프.
//
//   외곽 0..19 — 0 = 출발/도착 코너, 반시계 진행. 모서리: 5, 10, 15
//   대각선 A (5→15): 5 → 20 → 21 → 22(방) → 23 → 24 → 15
//   대각선 B (10→0): 10 → 25 → 26 → 22(방) → 27 → 28 → 0
//
// 지름길 규칙: 모서리(5, 10)에 "정확히 서면" 다음 이동부터 대각선 진입.
// 방(22)에 정확히 서면(5쪽 대각선 경유 시) 최단 출구(27→28→0)로 전환.

export const CENTER = 22;

export type ShortcutState = 'none' | 'from5' | 'from10' | 'centerExit';

const OUTER_FULL: number[] = Array.from({ length: 19 }, (_, i) => i + 1).concat([0]); // 1..19, 0
const ROUTE_FROM5 = [5, 20, 21, 22, 23, 24, 15, 16, 17, 18, 19, 0];
const ROUTE_FROM10 = [10, 25, 26, 22, 27, 28, 0];
const ROUTE_CENTER_EXIT = [22, 27, 28, 0];

function sliceAfter(route: number[], pos: number): number[] {
  const i = route.indexOf(pos);
  if (i < 0) throw new Error(`잘못된 위치: ${pos} (경로에 없음)`);
  return route.slice(i + 1);
}

/** 현재 위치에서 앞으로 지나갈 노드 목록 (마지막은 항상 도착 코너 0). 넘어서면 완주. */
export function remainingPath(pos: number | 'ready', shortcut: ShortcutState): number[] {
  if (pos === 'ready') return [...OUTER_FULL];
  switch (shortcut) {
    case 'from5':
      return sliceAfter(ROUTE_FROM5, pos);
    case 'from10':
      return sliceAfter(ROUTE_FROM10, pos);
    case 'centerExit':
      return sliceAfter(ROUTE_CENTER_EXIT, pos);
    case 'none': {
      if (pos === 0) return []; // 한 바퀴 돌아 도착 코너 — 어떤 던지기든 다음 이동은 완주
      const out: number[] = [];
      for (let n = pos + 1; n <= 19; n++) out.push(n);
      out.push(0);
      return out;
    }
  }
}

/** 이동 도착 후의 지름길 상태 */
export function nextShortcutState(landed: number, current: ShortcutState): ShortcutState {
  if (landed === 5) return 'from5';
  if (landed === 10) return 'from10';
  if (landed === CENTER) return current === 'from5' ? 'centerExit' : current;
  if (landed <= 19) return 'none'; // 외곽 복귀 (대각선 종점 15 포함)
  return current;
}

export interface MoveResult {
  dest: number | 'goal';
  /** 지나는 노드들 (도착 노드 포함, 완주 시 마지막 구간까지) — 이동 연출용 */
  path: number[];
}

export function computeMove(pos: number | 'ready', shortcut: ShortcutState, steps: number): MoveResult {
  const ahead = remainingPath(pos, shortcut);
  if (steps > ahead.length) return { dest: 'goal', path: ahead };
  return { dest: ahead[steps - 1], path: ahead.slice(0, steps) };
}

/** 완주까지 총 스텝 기준 진행도 (0=출발 전, 21=완주) — 봇 평가·역전 판정용 */
export const FULL_PROGRESS = OUTER_FULL.length + 1; // 21
export function progressOf(pos: number | 'ready' | 'goal', shortcut: ShortcutState): number {
  if (pos === 'goal') return FULL_PROGRESS;
  if (pos === 'ready') return 0;
  return FULL_PROGRESS - (remainingPath(pos, shortcut).length + 1);
}
