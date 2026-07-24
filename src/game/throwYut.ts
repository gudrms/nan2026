import type { Rng } from './rng';

export type YutName = 'do' | 'gae' | 'geol' | 'yut' | 'mo';

export interface YutThrow {
  /** 가락 4개의 상태. true = 배(평면)가 위 — 던지기 애니메이션 연출에 재사용 */
  sticks: boolean[];
  name: YutName;
  steps: 1 | 2 | 3 | 4 | 5;
  /** 윷·모 → 한 번 더 */
  bonus: boolean;
}

const BY_FLAT_COUNT: Record<number, { name: YutName; steps: 1 | 2 | 3 | 4 | 5 }> = {
  0: { name: 'mo', steps: 5 },
  1: { name: 'do', steps: 1 },
  2: { name: 'gae', steps: 2 },
  3: { name: 'geol', steps: 3 },
  4: { name: 'yut', steps: 4 },
};

// 가락 1개가 배(평면)로 떨어질 확률. 균등 1/5은 윷·모 40%로 템포 붕괴라 기각 (spec §4.3).
// 초기값 0.6 — 시뮬레이션 하네스로 게임 길이 확인 후 튜닝한다.
export const DEFAULT_P_FLAT = 0.6;

export function throwYut(rng: Rng, pFlat: number = DEFAULT_P_FLAT): YutThrow {
  const sticks = [0, 1, 2, 3].map(() => rng() < pFlat);
  const flat = sticks.filter(Boolean).length;
  const { name, steps } = BY_FLAT_COUNT[flat];
  return { sticks, name, steps, bonus: name === 'yut' || name === 'mo' };
}

/** steps(1~5)별 발생 확률 (이항분포) — 봇의 기대값 계산용 */
export function stepProbabilities(pFlat: number = DEFAULT_P_FLAT): Record<number, number> {
  const q = 1 - pFlat;
  const comb = [1, 4, 6, 4, 1];
  const pOf = (flat: number) => comb[flat] * pFlat ** flat * q ** (4 - flat);
  return { 1: pOf(1), 2: pOf(2), 3: pOf(3), 4: pOf(4), 5: pOf(0) };
}
