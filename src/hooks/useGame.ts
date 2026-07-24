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
import { detectEvents, type GameEvent } from '../game/events';
import { linesForEvent, startLines, type DialogueLine } from '../ai/presetLines';
import { requestLine } from '../ai/dialogueClient';
import { describeSituation } from '../ai/situation';
import { isMuted, setMuted, speak } from '../ai/ttsClient';

// 게임 코어 ↔ React 연결점. 봇 3인 턴 자동 진행 + 대사 파이프라인:
// 이벤트 → 프리셋 폴백과 함께 /api/dialogue 요청(3초 폴백) → 말풍선·표정·TTS 동시.
// 대사·음성은 전부 비동기 곁가지 — 게임 진행은 네트워크와 무관하다 (spec §3.1).

const BOT_THROW_DELAY = 900;
const BOT_MOVE_DELAY = 1100;
const BUBBLE_MS = 3600;
const LINE_STAGGER_MS = 450;
const HISTORY_MAX = 8;

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
  const [muted, setMutedState] = useState(isMuted());
  const stateRef = useRef(state);
  const rngRef = useRef<Rng>(mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0));
  const historyRef = useRef<{ actor: string; text: string }[]>([]);
  const bubbleSeq = useRef(0);

  const showLine = useCallback((line: DialogueLine) => {
    const bubble: Bubble = { ...line, id: ++bubbleSeq.current };
    // 같은 캐릭터의 이전 말풍선은 교체, 동시 표시는 최대 2개 (CONCEPT §6.2)
    setBubbles((cur) => [...cur.filter((b) => b.actor !== line.actor).slice(-1), bubble]);
    setTimeout(() => {
      setBubbles((cur) => cur.filter((b) => b.id !== bubble.id));
    }, BUBBLE_MS);
  }, []);

  /** 이벤트 1건 → 화자별 대사 요청 (LLM, 실패 시 프리셋 폴백) → 말풍선+TTS */
  const speakEvent = useCallback(
    (ev: GameEvent, nextState: GameState, fallbacks?: DialogueLine[]) => {
      const lines = (fallbacks ?? linesForEvent(ev, rngRef.current)).slice(0, 2);
      const situation = describeSituation(ev, nextState);
      lines.forEach((fallback, i) => {
        setTimeout(() => {
          void requestLine(
            { actor: fallback.actor, event: ev.type, situation, history: historyRef.current.slice(-5) },
            fallback,
          ).then((line) => {
            showLine(line);
            void speak(line.actor, line.text);
            historyRef.current.push({ actor: line.actor, text: line.text });
            if (historyRef.current.length > HISTORY_MAX) historyRef.current.shift();
          });
        }, i * LINE_STAGGER_MS);
      });
    },
    [showLine],
  );

  const apply = useCallback(
    (action: GameAction) => {
      const prev = stateRef.current;
      const next = reduce(prev, action);
      stateRef.current = next;
      setState(next);
      for (const ev of detectEvents(prev, action, next)) speakEvent(ev, next);
    },
    [speakEvent],
  );

  // 게임 시작 인사
  useEffect(() => {
    const ev: GameEvent = { type: 'GAME_START', actor: 'beomtiger', team: 'orange' };
    speakEvent(ev, stateRef.current, startLines(rngRef.current));
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

  const toggleMute = useCallback(() => {
    setMuted(!isMuted());
    setMutedState(isMuted());
  }, []);

  return {
    state,
    actor,
    bubbles,
    muted,
    toggleMute,
    playerCanThrow,
    playerCanMove,
    selectableMoves,
    playerThrow,
    playerSelect,
  };
}
