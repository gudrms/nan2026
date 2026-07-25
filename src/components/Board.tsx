import { useLayoutEffect, useState } from 'react';
import { BOARD_COORDS } from '../game/board';
import type { GameState, Mal, Move } from '../game/state';
import { sfxCapture, sfxStack, sfxStep } from '../audio/sfx';

// 윷판 렌더링 (SVG) — 디자인 시스템 §06. 노드는 원형, 모서리·방은 이중 원.
// 이동 가능 위치는 황색 하이라이트, 클릭으로 말 선택 (조작 2회 중 2번째 클릭).

const CORNERS = new Set([0, 5, 10, 15, 22]);
const TEAM_COLOR = { blue: 'var(--blue)', orange: 'var(--orange)' } as const;
const TEAM_HALO = { blue: 'rgba(44,95,168,.28)', orange: 'rgba(224,123,57,.32)' } as const;

interface BoardProps {
  state: GameState;
  /** 플레이어가 선택 가능한 수 (빈 배열이면 하이라이트 없음) */
  selectable: Move[];
  onSelect: (move: Move) => void;
  /** 직전 이동 — 경로를 따라 한 칸씩 스텝 연출 (F-8) */
  lastMove: Move | null;
  /** 깍이 훈수가 추천한 수 — 해당 칸에 추천 배지 표시 (F-1) */
  hintMove?: Move | null;
}

const STEP_MS = 200;

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

export default function Board({ state, selectable, onSelect, lastMove, hintMove }: BoardProps) {
  // 이동 그룹의 표시 위치를 경로 노드로 오버라이드 → 한 칸씩 이동 연출
  const [stepPos, setStepPos] = useState<{ moverId: string; node: number } | null>(null);

  useLayoutEffect(() => {
    if (!lastMove || typeof lastMove.to !== 'number' || lastMove.path.length === 0) {
      setStepPos(null);
      return;
    }
    const { path, malIds, captures, stacks } = lastMove;
    let i = 0;
    setStepPos({ moverId: malIds[0], node: path[0] });
    sfxStep(0);
    const timer = setInterval(() => {
      i += 1;
      if (i >= path.length) {
        clearInterval(timer);
        setStepPos(null);
        if (captures.length > 0) sfxCapture();
        else if (stacks.length > 0) sfxStack();
        return;
      }
      sfxStep(i);
      setStepPos({ moverId: malIds[0], node: path[i] });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [lastMove]);

  const moverMal = stepPos ? state.mals.find((m) => m.id === stepPos.moverId) : null;

  // 클릭 대상 노드: 완주 수는 출발 노드(from), 그 외는 도착 노드
  const targets = selectable.map((move) => ({
    move,
    node: typeof move.to === 'number' ? move.to : (move.from as number),
    isGoal: move.to === 'goal',
  }));

  return (
    <svg viewBox="0 0 500 500" style={{ width: '100%', maxWidth: 470, display: 'block' }}>
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

      {/* 이동 가능 위치 하이라이트 (말 아래 레이어) — 크고 진하게 (F-1) */}
      {targets.map(({ node, isGoal, move }) => {
        const [x, y] = BOARD_COORDS[node];
        const isHint =
          hintMove && move.from === hintMove.from && move.to === hintMove.to;
        return (
          <g key={`hl-${node}-${isGoal}`} className="node-highlight" onClick={() => onSelect(move)}>
            <circle cx={x} cy={y} r={28} fill={isHint ? 'rgba(233,185,76,.75)' : 'rgba(233,185,76,.52)'} />
            <circle cx={x} cy={y} r={28} fill="none" stroke="var(--gold)" strokeWidth={4.5} strokeDasharray="8 6" />
            {isGoal && (
              <text x={x} y={y - 34} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--red)">
                완주!
              </text>
            )}
            {isHint && (
              <g transform={`translate(${x},${y - 38})`}>
                <rect x={-38} y={-13} width={76} height={22} rx={11} fill="var(--blue)" stroke="var(--ink)" strokeWidth={2} />
                <text y={3.5} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--paper)">
                  깍이 추천!
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* 말 — 스텝 연출 중이면 경로 노드 위치로, 아니면 상태 위치로. 팀색 후광으로 구분 강화 */}
      {malGroups(state).map((g) => {
        const stepping = moverMal && g.team === moverMal.team && g.pos === moverMal.pos && stepPos;
        const [x, y] = BOARD_COORDS[stepping ? stepPos.node : g.pos];
        return (
          <g
            key={g.key}
            transform={`translate(${x},${y})`}
            style={{ transition: 'transform .16s ease', filter: 'drop-shadow(0 2px 3px rgba(42,39,34,.4))' }}
            pointerEvents="none"
          >
            <circle r={22} fill={TEAM_HALO[g.team]} />
            <circle r={16} fill={TEAM_COLOR[g.team]} stroke="var(--ink)" strokeWidth={3.5} />
            <circle r={6} fill="var(--paper)" />
            {g.count > 1 && (
              <g transform="translate(13,-13)">
                <circle r={9} fill="var(--gold)" stroke="var(--ink)" strokeWidth={2} />
                <text y={4} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--ink)">
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
