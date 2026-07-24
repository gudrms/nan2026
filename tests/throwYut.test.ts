import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/game/rng';
import { stepProbabilities, throwYut } from '../src/game/throwYut';

describe('throwYut', () => {
  it('같은 시드는 같은 결과 (재현성)', () => {
    const r1 = mulberry32(123);
    const r2 = mulberry32(123);
    for (let i = 0; i < 50; i++) {
      expect(throwYut(r1)).toEqual(throwYut(r2));
    }
  });

  it('배 개수 → 결과 매핑: 4개=윷, 0개=모 (둘 다 한 번 더)', () => {
    const allFlat = throwYut(() => 0); // rng()<p 항상 참
    expect(allFlat.name).toBe('yut');
    expect(allFlat.steps).toBe(4);
    expect(allFlat.bonus).toBe(true);

    const allRound = throwYut(() => 0.999);
    expect(allRound.name).toBe('mo');
    expect(allRound.steps).toBe(5);
    expect(allRound.bonus).toBe(true);
  });

  it('분포가 이항분포 이론치에 수렴한다 (p=0.6, 2만 회)', () => {
    const rng = mulberry32(42);
    const counts: Record<string, number> = { do: 0, gae: 0, geol: 0, yut: 0, mo: 0 };
    const N = 20_000;
    for (let i = 0; i < N; i++) counts[throwYut(rng).name]++;
    const theory: Record<string, number> = { do: 0.1536, gae: 0.3456, geol: 0.3456, yut: 0.1296, mo: 0.0256 };
    for (const name of Object.keys(theory)) {
      expect(Math.abs(counts[name] / N - theory[name])).toBeLessThan(0.01);
    }
  });

  it('stepProbabilities 합은 1', () => {
    const probs = stepProbabilities();
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});
