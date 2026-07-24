import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32, type Rng } from '../game/rng';
import { throwYut } from '../game/throwYut';
import {
  createInitialState,
  currentActor,
  reduce,
  type ActorId,
  type GameAction,
  type GameState,
  type Move,
} from '../game/state';
import { getMoves } from '../game/rules';
import { chooseMoveExpecti, PERSONALITIES } from '../game/botAI';
import { detectEvents } from '../game/events';
import { linesForEvent, startLines, type DialogueLine } from '../ai/presetLines';

// 게임 코어 ↔ React 연결점. 봇 3인(깍이·범발톱·꼬리아홉) 턴 자동 진행,
// 이벤트 → 말풍선(프리셋 대사) 표시. M3에서 대사 소스만 LLM+TTS로 교체된다.

const BOT_THROW_DELAY = 900;
const BOT_MOVE_DELAY = 1100;
const BUBBLE_MS = 3200;

export interface Bubble extends DialogueLine {
  id: number;
}

/** 개발·데모용: URL ?mals=1~4 로 팀당 말 개수 조정 (기본 4 — 보류 결정 D-1) */
function initialMalsPerTeam(): number {
  if (typeof window === 'undefined') return 4;
  const n = Number(new URLSearchParams(window.location.search).get('mals'));
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 4;
}

export function useGame() {
  const [state, setState] = useState<GameState>(() => createInitialState(initialMalsPerTeam()));
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const stateRef = useRef(state);
  const rngRef = useRef<Rng>(mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0));
  const bubbleSeq = useRef(0);

  const showLines = useCallback((lines: DialogueLine[]) => {
    const next = lines.slice(0, 2).map((l) => ({ ...l, id: ++bubbleSeq.current }));
    if (next.length === 0) return;
    setBubbles(next);
    const ids = new Set(next.map((b) => b.id));
    setTimeout(() => {
      setBubbles((cur) => cur.filter((b) => !ids.has(b.id)));
    }, BUBBLE_MS);
  }, []);

  const apply = useCallback(
    (action: GameAction) => {
      const prev = stateRef.current;
      const next = reduce(prev, action);
      stateRef.current = next;
      setState(next);
      const lines = detectEvents(prev, action, next).flatMap((ev) => linesForEvent(ev, rngRef.current));
      showLines(lines);
    },
    [showLines],
  );

  // 게임 시작 인사
  useEffect(() => {
    showLines(startLines(rngRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 봇 턴 자동 진행 (깍이·범발톱·꼬리아홉)
  useEffect(() => {
    if (state.phase === 'finished') return;
    const actor = currentActor(state);
    if (actor === 'player') return;
    const timer = setTimeout(
      () => {
        if (stateRef.current !== state) return; // 이미 진행됨 (StrictMode 중복 방지)
        if (state.phase === 'awaitingThrow') {
          apply({ type: 'THROW', yut: throwYut(rngRef.current) });
        } else {
          const move = chooseMoveExpecti(state, getMoves(state), PERSONALITIES[actor]);
          apply({ type: 'MOVE', move });
        }
      },
      state.phase === 'awaitingThrow' ? BOT_THROW_DELAY : BOT_MOVE_DELAY,
    );
    return () => clearTimeout(timer);
  }, [state, apply]);

  const actor: ActorId = currentActor(state);
  const playerCanThrow = actor === 'player' && state.phase === 'awaitingThrow';
  const playerCanMove = actor === 'player' && state.phase === 'awaitingMove';
  const selectableMoves = useMemo<Move[]>(() => (playerCanMove ? getMoves(state) : []), [playerCanMove, state]);

  const playerThrow = useCallback(() => {
    if (stateRef.current.phase !== 'awaitingThrow') return;
    apply({ type: 'THROW', yut: throwYut(rngRef.current) });
  }, [apply]);

  const playerSelect = useCallback(
    (move: Move) => {
      if (stateRef.current.phase !== 'awaitingMove') return;
      apply({ type: 'MOVE', move });
    },
    [apply],
  );

  return { state, actor, bubbles, playerCanThrow, playerCanMove, selectableMoves, playerThrow, playerSelect };
}
