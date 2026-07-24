import { BOARD_COORDS } from '../game/board';
import type { GameState, Mal, Move } from '../game/state';

// 윷판 렌더링 (SVG) — 디자인 시스템 §06. 노드는 원형, 모서리·방은 이중 원.
// 이동 가능 위치는 황색 하이라이트, 클릭으로 말 선택 (조작 2회 중 2번째 클릭).

const CORNERS = new Set([0, 5, 10, 15, 22]);
const TEAM_COLOR = { blue: 'var(--blue)', orange: 'var(--orange)' } as const;

interface BoardProps {
  state: GameState;
  /** 플레이어가 선택 가능한 수 (빈 배열이면 하이라이트 없음) */
  selectable: Move[];
  onSelect: (move: Move) => void;
}

interface MalGroup {
  key: string;
  pos: number;
  team: Mal['team'];
  count: number;
}

function malGroups(state: GameState): MalGroup[] {
  const map = new Map<string, MalGroup>();
  for (const m of state.mals) {
    if (typeof m.pos !== 'number') continue;
    const key = `${m.team}:${m.pos}`;
    const g = map.get(key);
    if (g) g.count += 1;
    else map.set(key, { key, pos: m.pos, team: m.team, count: 1 });
  }
  return [...map.values()];
}

export default function Board({ state, selectable, onSelect }: BoardProps) {
  // 클릭 대상 노드: 완주 수는 출발 노드(from), 그 외는 도착 노드
  const targets = selectable.map((move) => ({
    move,
    node: typeof move.to === 'number' ? move.to : (move.from as number),
    isGoal: move.to === 'goal',
  }));

  return (
    <svg viewBox="0 0 500 500" style={{ width: '100%', maxWidth: 520, display: 'block' }}>
      <rect x={34} y={34} width={432} height={432} rx={28} fill="var(--paper)" stroke="var(--line)" strokeWidth={2.5} />
      {(
        [
          [60, 60, 440, 60],
          [440, 60, 440, 440],
          [440, 440, 60, 440],
          [60, 440, 60, 60],
          [60, 60, 440, 440],
          [440, 60, 60, 440],
        ] as const
      ).map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-soft)" strokeWidth={3} />
      ))}

      {Object.entries(BOARD_COORDS).map(([id, [x, y]]) => {
        const n = Number(id);
        return CORNERS.has(n) ? (
          <g key={id}>
            <circle cx={x} cy={y} r={19} fill="var(--paper)" stroke="var(--ink)" strokeWidth={3} />
            <circle cx={x} cy={y} r={10.5} fill="none" stroke="var(--ink)" strokeWidth={2.2} />
          </g>
        ) : (
          <circle key={id} cx={x} cy={y} r={11} fill="var(--paper)" stroke="var(--wood)" strokeWidth={2.5} />
        );
      })}
      <circle cx={250} cy={250} r={4.5} fill="var(--red)" />
      <text x={440} y={483} textAnchor="middle" fontSize={17} fontWeight={800} fill="var(--text-muted)">
        출발 · 도착
      </text>

      {/* 이동 가능 위치 하이라이트 (말 아래 레이어) */}
      {targets.map(({ node, isGoal, move }) => {
        const [x, y] = BOARD_COORDS[node];
        return (
          <g key={`hl-${node}-${isGoal}`} className="node-highlight" onClick={() => onSelect(move)}>
            <circle cx={x} cy={y} r={24} fill="rgba(233,185,76,.4)" />
            <circle cx={x} cy={y} r={24} fill="none" stroke="var(--gold)" strokeWidth={3.5} strokeDasharray="7 6" />
            {isGoal && (
              <text x={x} y={y - 30} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--red)">
                완주!
              </text>
            )}
          </g>
        );
      })}

      {/* 말 — 같은 그룹은 위치가 바뀌면 CSS transition으로 미끄러진다 */}
      {malGroups(state).map((g) => {
        const [x, y] = BOARD_COORDS[g.pos];
        return (
          <g key={g.key} transform={`translate(${x},${y})`} style={{ transition: 'transform .45s ease' }} pointerEvents="none">
            <circle r={14} fill={TEAM_COLOR[g.team]} stroke="var(--ink)" strokeWidth={3} />
            <circle r={5.5} fill="var(--paper)" />
            {g.count > 1 && (
              <g transform="translate(11,-11)">
                <circle r={8} fill="var(--gold)" stroke="var(--ink)" strokeWidth={2} />
                <text y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--ink)">
                  {g.count}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* 클릭 영역을 말 위로 다시 얹기 (잡기 대상 칸도 클릭 가능하도록) */}
      {targets.map(({ node, move, isGoal }) => {
        const [x, y] = BOARD_COORDS[node];
        return (
          <circle
            key={`ck-${node}-${isGoal}`}
            cx={x}
            cy={y}
            r={26}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(move)}
          />
        );
      })}
    </svg>
  );
}
