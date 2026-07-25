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
import {
  HINT_DESC,
  hintFallback,
  linesForEvent,
  startLines,
  type DialogueLine,
  type HintKind,
} from '../ai/presetLines';
import { requestLine } from '../ai/dialogueClient';
import { describeSituation } from '../ai/situation';
import { isMuted, setMuted, speak } from '../ai/ttsClient';
import { sfxFinish, sfxThrow } from '../audio/sfx';

// 게임 코어 ↔ React 연결점. 봇 3인 턴 자동 진행 + 대사 파이프라인:
// 이벤트 → 프리셋 폴백과 함께 /api/dialogue 요청(3초 폴백) → 말풍선·표정·TTS 동시.
// 대사·음성은 전부 비동기 곁가지 — 게임 진행은 네트워크와 무관하다 (spec §3.1).

// 봇 턴 템포 — 토스 연출(0.68s)+결과 읽기를 고려해 여유 있게 (기획 피드백 F-6)
const BOT_THROW_DELAY = 1400;
const BOT_MOVE_DELAY = 2000;
const BUBBLE_MIN_MS = 4500; // 음성이 없을 때(폴백·음소거) 최소 표시 시간
const BUBBLE_MAX_MS = 12000; // 안전 상한
const BUBBLE_AFTER_VOICE_MS = 600; // 음성 종료 후 여운
const LINE_STAGGER_MS = 450;
const HISTORY_MAX = 8;
const HINT_DELAY_MS = 5000;

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
  const [lastMove, setLastMove] = useState<Move | null>(null); // 스텝 이동 연출용 (F-8)
  const stateRef = useRef(state);
  const rngRef = useRef<Rng>(mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0));
  const historyRef = useRef<{ actor: string; text: string }[]>([]);
  const bubbleSeq = useRef(0);

  const pushBubble = useCallback((line: DialogueLine): number => {
    const id = ++bubbleSeq.current;
    // 같은 캐릭터의 이전 말풍선은 교체, 동시 표시는 최대 2개 (CONCEPT §6.2)
    setBubbles((cur) => [...cur.filter((b) => b.actor !== line.actor).slice(-1), { ...line, id }]);
    return id;
  }, []);

  const removeBubble = useCallback((id: number) => {
    setBubbles((cur) => cur.filter((b) => b.id !== id));
  }, []);

  /** 대사 1줄 표시 + TTS + 히스토리. 말풍선은 음성 재생이 끝날 때까지 유지(싱크) */
  const deliverLine = useCallback(
    (line: DialogueLine) => {
      const id = pushBubble(line);
      historyRef.current.push({ actor: line.actor, text: line.text });
      if (historyRef.current.length > HISTORY_MAX) historyRef.current.shift();

      const shownAt = Date.now();
      const hardCap = setTimeout(() => removeBubble(id), BUBBLE_MAX_MS);
      void speak(line.actor, line.text).then(() => {
        // 음성 종료(또는 음성 없음) 시점 기준으로 정리 — 최소 표시 시간은 보장
        clearTimeout(hardCap);
        const remain = Math.max(BUBBLE_MIN_MS - (Date.now() - shownAt), BUBBLE_AFTER_VOICE_MS);
        setTimeout(() => removeBubble(id), remain);
      });
    },
    [pushBubble, removeBubble],
  );

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
          ).then(deliverLine);
        }, i * LINE_STAGGER_MS);
      });
    },
    [deliverLine],
  );

  const apply = useCallback(
    (action: GameAction) => {
      const prev = stateRef.current;
      const next = reduce(prev, action);
      stateRef.current = next;
      setState(next);
      if (action.type === 'THROW') {
        sfxThrow(); // 결과음은 토스 연출 후 GameScreen에서, 이동음은 Board 스텝 연출에서
      } else {
        setLastMove(action.move);
        if (action.move.to === 'goal') sfxFinish();
      }
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

  // 플레이어 장고(5초+) 시 깍이 훈수 (CONCEPT §6.2) — 판단 AI의 최선 수를 성격 AI가 말로 전달.
  // 선택지가 2개 이상일 때만 (하나뿐이면 훈수가 무의미)
  useEffect(() => {
    if (!playerCanMove || selectableMoves.length < 2) return;
    const timer = setTimeout(() => {
      if (stateRef.current !== state) return;
      const best = chooseMoveExpecti(state, selectableMoves, PERSONALITIES.kkaki);
      const kind: HintKind =
        best.captures.length > 0
          ? 'capture'
          : best.to === 'goal'
            ? 'goal'
            : best.stacks.length > 0
              ? 'stack'
              : best.to === 5 || best.to === 10
                ? 'shortcut'
                : 'advance';
      void requestLine(
        {
          actor: 'kkaki',
          event: 'HINT',
          situation: `플레이어(대장)가 어느 말을 움직일지 한참 고민 중이다. 깍이가 계산한 최선의 수: ${HINT_DESC[kind]}. 대장에게 이 수를 짧게 훈수한다.`,
          history: historyRef.current.slice(-5),
        },
        hintFallback(kind, rngRef.current),
      ).then(deliverLine);
    }, HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playerCanMove, selectableMoves, state, deliverLine]);

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
    lastMove,
    playerCanThrow,
    playerCanMove,
    selectableMoves,
    playerThrow,
    playerSelect,
  };
}
