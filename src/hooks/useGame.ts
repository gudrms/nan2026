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
  resultReactionLine,
  startLines,
  turnOpenLine,
  type DialogueLine,
  type Emotion,
  type HintKind,
} from '../ai/presetLines';
import { requestLine } from '../ai/dialogueClient';
import { describeSituation } from '../ai/situation';
import { isMuted, setMuted, speak } from '../ai/ttsClient';
import { sfxFinish, sfxThrow } from '../audio/sfx';

// 게임 코어 ↔ React 연결점. 봇 3인 턴 자동 진행 + 대사 파이프라인:
// 이벤트 → 프리셋 폴백과 함께 /api/dialogue 요청(3초 폴백) → 말풍선·표정·TTS 동시.
// 대사·음성은 전부 비동기 곁가지 — 게임 진행은 네트워크와 무관하다 (spec §3.1).

// 턴 드라이버 템포 (H-4 동기식 진행)
const TOSS_TOTAL_MS = 950; // 토스 0.7s + 결과 읽기 여유
const STEP_SETTLE_MS = 600; // 스텝 이동 연출 여유
const BUBBLE_MIN_MS = 4500; // 음성이 없을 때(폴백·음소거) 최소 표시 시간
const BUBBLE_MAX_MS = 12000; // 안전 상한
const BUBBLE_AFTER_VOICE_MS = 600; // 음성 종료 후 여운
const LINE_STAGGER_MS = 450;
const HISTORY_MAX = 8;
const HINT_DELAY_MS = 5000;

export interface Bubble extends DialogueLine {
  id: number;
  /** 전체 텍스트가 드러나는 시간(ms) — 음성 길이에 맞춤 */
  revealMs: number;
}

const TYPE_MS_PER_CHAR = 45;
const VOICE_WAIT_MAX_MS = 4000; // 음성 큐 대기 상한 — 넘으면 말풍선 먼저 표시

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
  const [hintMove, setHintMove] = useState<Move | null>(null); // 훈수 추천 수 표시용 (F-1)
  // 팀 전체 표정 리액션 (I-4): 말풍선이 없어도 이벤트에 표정으로 반응
  const NEUTRAL_MOODS: Record<ActorId, Emotion> = { player: 'neutral', kkaki: 'neutral', beomtiger: 'neutral', ninetail: 'neutral' };
  const [moods, setMoods] = useState<Record<ActorId, Emotion>>(NEUTRAL_MOODS);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [introDone, setIntroDone] = useState(false); // 시작 인사 종료 전에는 던지기 잠금 (I-2)
  // 턴 오프닝 대사("대장 차례예요!") 낭독 중에는 던지기 잠금 — 안 그러면 플레이어가
  // 대사 중간에 던져버려 driverBusy가 true인 채로 상태가 바뀌어 드라이버가 다음 턴을 못 잡는다
  const [turnOpenPending, setTurnOpenPending] = useState(false);
  const [extraTurn, setExtraTurn] = useState(false); // "한 번 더" 표시용 (윷·모·잡기 추가 턴)
  const stateRef = useRef(state);
  const rngRef = useRef<Rng>(mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0));
  const historyRef = useRef<{ actor: string; text: string }[]>([]);
  const bubbleSeq = useRef(0);
  // 발화 체인 (J-1 엄격 동기): 모든 대사(LLM 응답 대기 포함)를 이어붙이고,
  // 턴 드라이버는 체인이 완전히 빌 때까지 기다린 뒤 다음 액션을 진행한다
  const speechTail = useRef<Promise<void>>(Promise.resolve());
  const trackSpeech = useCallback((p: Promise<void>) => {
    speechTail.current = speechTail.current.then(() => p).catch(() => {});
  }, []);
  const waitSpeech = useCallback(async () => {
    for (;;) {
      const tail = speechTail.current;
      await tail;
      if (speechTail.current === tail) return; // 대기 중 새 대사가 안 붙었으면 종료
    }
  }, []);

  const pushBubble = useCallback((line: DialogueLine, revealMs: number): number => {
    const id = ++bubbleSeq.current;
    // 같은 캐릭터의 이전 말풍선은 교체, 동시 표시는 최대 2개 (CONCEPT §6.2)
    setBubbles((cur) => [...cur.filter((b) => b.actor !== line.actor).slice(-1), { ...line, id, revealMs }]);
    return id;
  }, []);

  const removeBubble = useCallback((id: number) => {
    setBubbles((cur) => cur.filter((b) => b.id !== id));
  }, []);

  /**
   * 대사 1줄: 말풍선은 "음성 재생이 실제로 시작되는 순간" 표시된다 (G-1 싱크).
   * AI 둘이 연달아 말하면 두 번째 말풍선은 자기 음성 차례가 올 때까지 뜨지 않는다.
   * 음성이 없으면(폴백·음소거·dev) 즉시 표시. 타자기 페이스는 음성 길이에 맞춤.
   */
  const deliverLine = useCallback(
    (line: DialogueLine) => {
      historyRef.current.push({ actor: line.actor, text: line.text });
      if (historyRef.current.length > HISTORY_MAX) historyRef.current.shift();

      const defaultMs = line.text.length * TYPE_MS_PER_CHAR;
      let bubbleId: number | null = null;
      let shownAt = 0;
      const show = (revealMs: number) => {
        if (bubbleId !== null) return;
        bubbleId = pushBubble(line, revealMs);
        shownAt = Date.now();
        setTimeout(() => bubbleId !== null && removeBubble(bubbleId), BUBBLE_MAX_MS);
      };

      // 음성 큐가 너무 오래 밀리면 말풍선이라도 먼저 (안전망)
      const safety = setTimeout(() => show(defaultMs), VOICE_WAIT_MAX_MS);
      // 반환 프로미스는 "음성 종료 시점"에 resolve — 턴 드라이버가 순차 진행에 사용 (H-4)
      const done = speak(line.actor, line.text, (durationSec) => {
        clearTimeout(safety);
        show(durationSec ? durationSec * 1000 * 0.85 : defaultMs);
      }).then(() => {
        clearTimeout(safety);
        show(defaultMs); // 음성이 없었던 경우 — 즉시 표시
        const remain = Math.max(BUBBLE_MIN_MS - (Date.now() - shownAt), BUBBLE_AFTER_VOICE_MS);
        setTimeout(() => bubbleId !== null && removeBubble(bubbleId), remain);
      });
      trackSpeech(done);
      return done;
    },
    [pushBubble, removeBubble, trackSpeech],
  );

  /** 이벤트 1건 → 화자별 대사 요청 (LLM, 실패 시 프리셋 폴백) → 말풍선+TTS.
   *  대사량 억제(I-1): 이벤트당 1줄, 드라마 핵심인 잡기·게임종료만 2줄 */
  const speakEvent = useCallback(
    (ev: GameEvent, nextState: GameState, fallbacks?: DialogueLine[]) => {
      const maxLines = ev.type === 'CAPTURE' || ev.type === 'GAME_END' ? 2 : 1;
      const lines = (fallbacks ?? linesForEvent(ev, rngRef.current)).slice(0, maxLines);
      const situation = describeSituation(ev, nextState);
      lines.forEach((fallback, i) => {
        // LLM 응답 대기까지 포함한 전체 파이프라인을 발화 체인에 등록 —
        // 드라이버의 waitSpeech가 "대사가 완전히 끝날 때"까지 기다릴 수 있게 (J-1)
        trackSpeech(
          (async () => {
            await new Promise((r) => setTimeout(r, i * LINE_STAGGER_MS));
            const line = await requestLine(
              { actor: fallback.actor, event: ev.type, situation, history: historyRef.current.slice(-5) },
              fallback,
            );
            await deliverLine(line);
          })(),
        );
      });
    },
    [deliverLine, trackSpeech],
  );

  const apply = useCallback(
    (action: GameAction) => {
      const prev = stateRef.current;
      const next = reduce(prev, action);
      stateRef.current = next;
      setState(next);
      if (action.type === 'THROW') {
        sfxThrow(); // 결과음은 토스 연출 후 GameScreen에서, 이동음은 Board 스텝 연출에서
        setExtraTurn(false);
      } else {
        setLastMove(action.move);
        setHintMove(null);
        if (action.move.to === 'goal') sfxFinish();
        // 같은 참가자가 이어서 던지면 "한 번 더" (윷·모·잡기) — 버그로 오해하지 않게 표시
        setExtraTurn(next.phase === 'awaitingThrow' && next.turnIdx === prev.turnIdx);
      }
      const events = detectEvents(prev, action, next);
      for (const ev of events) {
        // YUT_MO 대사는 결과 리액션(resultReactionLine)이 대체 — 중복 발화 방지
        if (ev.type !== 'YUT_MO') speakEvent(ev, next);
        // 팀 전체가 표정으로 반응 (I-4)
        const blueTeam: ActorId[] = ['player', 'kkaki'];
        const orangeTeam: ActorId[] = ['beomtiger', 'ninetail'];
        let blueMood: Emotion | null = null;
        let orangeMood: Emotion | null = null;
        if (ev.type === 'GAME_END') {
          blueMood = ev.detail?.winner === 'blue' ? 'joy' : 'anger';
          orangeMood = ev.detail?.winner === 'orange' ? 'joy' : 'anger';
        } else if (ev.type === 'CAPTURE') {
          blueMood = ev.team === 'blue' ? 'joy' : 'anger';
          orangeMood = ev.team === 'orange' ? 'joy' : 'anger';
        } else if (ev.type === 'YUT_MO') {
          if (ev.team === 'blue') blueMood = 'joy';
          else orangeMood = 'joy';
        } else if (ev.type === 'LEAD_CHANGE') {
          blueMood = ev.detail?.newLeader === 'blue' ? 'joy' : 'surprise';
          orangeMood = ev.detail?.newLeader === 'orange' ? 'joy' : 'surprise';
        }
        if (blueMood || orangeMood) {
          setMoods((cur) => {
            const out = { ...cur };
            if (blueMood) for (const a of blueTeam) out[a] = blueMood;
            if (orangeMood) for (const a of orangeTeam) out[a] = orangeMood;
            return out;
          });
          if (moodTimer.current) clearTimeout(moodTimer.current);
          if (ev.type !== 'GAME_END') {
            moodTimer.current = setTimeout(() => setMoods(NEUTRAL_MOODS), 4000);
          }
        }
      }
    },
    [speakEvent],
  );

  // 게임 시작 인사 — 순차 발화, 끝나면 던지기 개방 (I-2)
  useEffect(() => {
    const ev: GameEvent = { type: 'GAME_START', actor: 'beomtiger', team: 'orange' };
    const situation = describeSituation(ev, stateRef.current);
    void (async () => {
      for (const fb of startLines(rngRef.current)) {
        const line = await requestLine(
          { actor: fb.actor, event: 'GAME_START', situation, history: [] },
          fb,
        );
        await deliverLine(line);
      }
      setIntroDone(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 턴 드라이버 (H-4 동기식): 차례 알림 → 던지기 → 결과 리액션 → 이동을 순차 진행.
  // 각 대사는 음성 종료까지 기다린다 — "주거니 받거니" 리듬.
  const driverBusy = useRef(false);
  const openedTurnIdx = useRef(-1);
  useEffect(() => {
    if (driverBusy.current) return;
    if (!introDone) return; // 시작 인사가 끝나야 턴 시작
    if (state.phase !== 'awaitingThrow' || state.winner) return;
    driverBusy.current = true;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    void (async () => {
      try {
        for (;;) {
          // 이전 액션이 유발한 대사(잡기 반응 등, LLM 대기 포함)가 전부 끝나야 다음 진행 (J-1 엄격 동기)
          await waitSpeech();
          const s = stateRef.current;
          if (s.phase !== 'awaitingThrow' || s.winner) break;
          const turnActor = currentActor(s);
          // 턴 오프닝 — 추가 턴(같은 참가자 한 번 더)에는 생략. 음성 종료까지 대기
          if (openedTurnIdx.current !== s.turnIdx) {
            openedTurnIdx.current = s.turnIdx;
            setTurnOpenPending(true);
            await deliverLine(turnOpenLine(turnActor, rngRef.current));
            setTurnOpenPending(false);
            await sleep(150);
          }
          if (turnActor === 'player') break; // 버튼 입력 대기 (안내는 이미 나감)
          if (stateRef.current.phase !== 'awaitingThrow') break;
          apply({ type: 'THROW', yut: throwYut(rngRef.current) });
          await sleep(TOSS_TOTAL_MS);
          const cur = stateRef.current;
          if (cur.phase !== 'awaitingMove' || !cur.pendingThrow) break;
          await deliverLine(resultReactionLine(turnActor, cur.pendingThrow.name, rngRef.current));
          await sleep(150);
          if (stateRef.current !== cur) break;
          const move = chooseMoveExpecti(cur, getMoves(cur), PERSONALITIES[turnActor]);
          apply({ type: 'MOVE', move });
          await sleep(STEP_SETTLE_MS);
        }
      } finally {
        driverBusy.current = false;
        setTurnOpenPending(false); // 안전망 — 예외로 루프가 끊겨도 던지기 잠금이 영구히 남지 않게
      }
    })();
  }, [state, introDone, apply, deliverLine]);

  const actor: ActorId = currentActor(state);
  const playerCanThrow = actor === 'player' && state.phase === 'awaitingThrow' && introDone && !turnOpenPending;
  const playerCanMove = actor === 'player' && state.phase === 'awaitingMove';
  const selectableMoves = useMemo<Move[]>(() => (playerCanMove ? getMoves(state) : []), [playerCanMove, state]);

  // 플레이어 장고(5초+) 시 까비 훈수 (CONCEPT §6.2) — 판단 AI의 최선 수를 성격 AI가 말로 전달.
  // 선택지가 2개 이상일 때만 (하나뿐이면 훈수가 무의미)
  useEffect(() => {
    if (!playerCanMove || selectableMoves.length < 2) return;
    const timer = setTimeout(() => {
      if (stateRef.current !== state) return;
      const best = chooseMoveExpecti(state, selectableMoves, PERSONALITIES.kkaki);
      setHintMove(best); // 추천 칸을 판에 표시 (F-1)
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
          situation: `플레이어(대장)가 어느 말을 움직일지 한참 고민 중이다. 까비가 계산한 최선의 수: ${HINT_DESC[kind]}. 대장에게 이 수를 짧게 훈수한다.`,
          history: historyRef.current.slice(-5),
        },
        hintFallback(kind, rngRef.current),
      ).then(deliverLine);
    }, HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playerCanMove, selectableMoves, state, deliverLine]);

  const playerThrow = useCallback(() => {
    if (stateRef.current.phase !== 'awaitingThrow') return;
    const yut = throwYut(rngRef.current);
    apply({ type: 'THROW', yut });
    // 결과가 공개되면 까비가 리액션 ("모예요, 대장!")
    setTimeout(() => {
      if (stateRef.current.pendingThrow === yut) {
        void deliverLine(resultReactionLine('player', yut.name, rngRef.current));
      }
    }, TOSS_TOTAL_MS);
  }, [apply, deliverLine]);

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
    hintMove,
    moods,
    extraTurn,
    playerCanThrow,
    playerCanMove,
    selectableMoves,
    playerThrow,
    playerSelect,
  };
}
