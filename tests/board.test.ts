import { describe, expect, it } from 'vitest';
import { computeMove, nextShortcutState, progressOf, remainingPath, FULL_PROGRESS } from '../src/game/board';

describe('remainingPath', () => {
  it('대기 말은 외곽 한 바퀴(20칸)를 남긴다', () => {
    const path = remainingPath('ready', 'none');
    expect(path).toHaveLength(20);
    expect(path[0]).toBe(1);
    expect(path[19]).toBe(0);
  });

  it('외곽 중간(3)에서는 4..19, 0 순서', () => {
    const path = remainingPath(3, 'none');
    expect(path[0]).toBe(4);
    expect(path[path.length - 1]).toBe(0);
    expect(path).toHaveLength(17);
  });

  it('도착 코너(0)에 서면 남은 칸이 없다 — 다음 이동은 곧장 완주', () => {
    expect(remainingPath(0, 'none')).toHaveLength(0);
  });

  it('모서리 5 지름길: 20→21→22(방)→23→24→15→외곽', () => {
    expect(remainingPath(5, 'from5')).toEqual([20, 21, 22, 23, 24, 15, 16, 17, 18, 19, 0]);
  });

  it('모서리 10 지름길: 25→26→22(방)→27→28→0', () => {
    expect(remainingPath(10, 'from10')).toEqual([25, 26, 22, 27, 28, 0]);
  });

  it('방(22) 정지 후 최단 출구: 27→28→0', () => {
    expect(remainingPath(22, 'centerExit')).toEqual([27, 28, 0]);
  });
});

describe('nextShortcutState', () => {
  it('모서리 5·10에 정확히 서면 지름길 진입', () => {
    expect(nextShortcutState(5, 'none')).toBe('from5');
    expect(nextShortcutState(10, 'none')).toBe('from10');
  });

  it('5쪽 대각선으로 방(22)에 정확히 서면 최단 출구로 전환', () => {
    expect(nextShortcutState(22, 'from5')).toBe('centerExit');
  });

  it('10쪽 대각선은 방을 지나도 경로 유지 (같은 직선)', () => {
    expect(nextShortcutState(22, 'from10')).toBe('from10');
  });

  it('대각선 종점(15)·외곽 복귀 시 지름길 상태 해제', () => {
    expect(nextShortcutState(15, 'from5')).toBe('none');
    expect(nextShortcutState(7, 'none')).toBe('none');
  });

  it('대각선 중간 노드에서는 상태 유지', () => {
    expect(nextShortcutState(21, 'from5')).toBe('from5');
    expect(nextShortcutState(27, 'centerExit')).toBe('centerExit');
  });
});

describe('computeMove', () => {
  it('투입: 대기에서 5스텝이면 모서리 5에 선다', () => {
    expect(computeMove('ready', 'none', 5)).toEqual({ dest: 5, path: [1, 2, 3, 4, 5] });
  });

  it('도착 코너(0)에서는 어떤 스텝이든 완주', () => {
    expect(computeMove(0, 'none', 1).dest).toBe('goal');
    expect(computeMove(0, 'none', 5).dest).toBe('goal');
  });

  it('19에서 1스텝이면 0에 정지, 2스텝 이상이면 완주 (오버슈트 허용)', () => {
    expect(computeMove(19, 'none', 1).dest).toBe(0);
    expect(computeMove(19, 'none', 2).dest).toBe('goal');
  });

  it('방(22) 최단 출구에서 4스텝이면 완주', () => {
    expect(computeMove(22, 'centerExit', 3).dest).toBe(0);
    expect(computeMove(22, 'centerExit', 4).dest).toBe('goal');
  });
});

describe('progressOf', () => {
  it('완주=21, 대기=0', () => {
    expect(progressOf('goal', 'none')).toBe(FULL_PROGRESS);
    expect(progressOf('ready', 'none')).toBe(0);
  });

  it('지름길을 탄 말이 같은 노드라도 더 앞서 있다', () => {
    // 방(22)에서 최단 출구(3스텝 남음) vs 5쪽 대각선 통과 중(8스텝 남음)
    expect(progressOf(22, 'centerExit')).toBeGreaterThan(progressOf(22, 'from5'));
  });
});
