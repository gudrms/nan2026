// 자동 대전 시뮬레이션 하네스 (spec §4.5) — 헤드리스 봇 4인 대전으로 밸런싱·AI 개선을 정량 검증.
// 실행: npm run simulate -- --games 1000 [--mals 4] [--p 0.6] [--seed 42]
import { mulberry32 } from './rng';

// CLI(tsx) 실행 전용 — @types/node를 프로젝트 전역에 넣지 않기 위한 최소 선언
declare const process: { argv: string[] } | undefined;
import { DEFAULT_P_FLAT, throwYut, type YutName } from './throwYut';
import { createInitialState, currentTeam, reduce, type TeamId } from './state';
import { getMoves } from './rules';
import { chooseMove } from './botAI';

export interface SimOptions {
  games: number;
  malsPerTeam: number;
  pFlat: number;
  seed: number;
}

export interface SimStats {
  games: number;
  wins: Record<TeamId, number>;
  avgMovesPerGame: number;
  avgThrowsPerGame: number;
  avgCapturesPerGame: Record<TeamId, number>;
  throwDist: Record<YutName, number>;
  totalThrows: number;
}

export function simulate(opts: Partial<SimOptions> = {}): SimStats {
  const { games = 1000, malsPerTeam = 4, pFlat = DEFAULT_P_FLAT, seed = 42 } = opts;
  const rng = mulberry32(seed);
  const wins: Record<TeamId, number> = { blue: 0, orange: 0 };
  const captures: Record<TeamId, number> = { blue: 0, orange: 0 };
  const throwDist: Record<YutName, number> = { do: 0, gae: 0, geol: 0, yut: 0, mo: 0 };
  let totalMoves = 0;
  let totalThrows = 0;

  for (let g = 0; g < games; g++) {
    let state = createInitialState(malsPerTeam);
    let guard = 0;
    while (state.phase !== 'finished' && guard++ < 10_000) {
      if (state.phase === 'awaitingThrow') {
        const yut = throwYut(rng, pFlat);
        throwDist[yut.name]++;
        totalThrows++;
        state = reduce(state, { type: 'THROW', yut });
      } else {
        const team = currentTeam(state);
        const move = chooseMove(state, getMoves(state));
        captures[team] += move.captures.length;
        state = reduce(state, { type: 'MOVE', move });
      }
    }
    if (state.winner) wins[state.winner]++;
    totalMoves += state.moveCount;
  }

  return {
    games,
    wins,
    avgMovesPerGame: totalMoves / games,
    avgThrowsPerGame: totalThrows / games,
    avgCapturesPerGame: { blue: captures.blue / games, orange: captures.orange / games },
    throwDist,
    totalThrows,
  };
}

function parseArgs(argv: string[]): Partial<SimOptions> {
  const opts: Partial<SimOptions> = {};
  for (let i = 0; i < argv.length; i++) {
    const next = () => Number(argv[++i]);
    if (argv[i] === '--games') opts.games = next();
    else if (argv[i] === '--mals') opts.malsPerTeam = next();
    else if (argv[i] === '--p') opts.pFlat = next();
    else if (argv[i] === '--seed') opts.seed = next();
  }
  return opts;
}

const isMain =
  typeof process !== 'undefined' &&
  !!process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('simulate.ts');

if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const stats = simulate(opts);
  const elapsed = Date.now() - started;
  const pct = (n: number) => `${((n / stats.games) * 100).toFixed(1)}%`;
  console.log(`\n=== 자동 대전 ${stats.games}판 (${elapsed}ms) ===`);
  console.log(`승률       blue(선공) ${pct(stats.wins.blue)} : orange ${pct(stats.wins.orange)}`);
  console.log(`평균 이동  ${stats.avgMovesPerGame.toFixed(1)}회 / 평균 던지기 ${stats.avgThrowsPerGame.toFixed(1)}회`);
  console.log(
    `평균 잡기  blue ${stats.avgCapturesPerGame.blue.toFixed(2)} : orange ${stats.avgCapturesPerGame.orange.toFixed(2)}`,
  );
  const dist = Object.entries(stats.throwDist)
    .map(([k, v]) => `${k} ${((v / stats.totalThrows) * 100).toFixed(1)}%`)
    .join(' / ');
  console.log(`던지기 분포 ${dist}`);
  console.log(`(이론치: do 15.4 / gae 34.6 / geol 34.6 / yut 13.0 / mo 2.6)\n`);
}
