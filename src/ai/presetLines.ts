import type { GameEvent } from '../game/events';
import type { Rng } from '../game/rng';
import type { ActorId } from '../game/state';
import type { YutName } from '../game/throwYut';

// 프리셋 대사 풀 — M2에서는 말풍선 기본 대사, M3부터는 LLM 실패/타임아웃 폴백으로 사용.
// 캐릭터 말투는 CONCEPT §4 페르소나 사양을 따른다.

export type Emotion = 'neutral' | 'joy' | 'anger' | 'surprise';

export interface DialogueLine {
  actor: ActorId;
  text: string;
  emotion: Emotion;
}

const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

const YUT_KO: Record<YutName, string> = { do: '도', gae: '개', geol: '걸', yut: '윷', mo: '모' };

// 시작 인사 — 템포를 위해 1줄만 (양 팀 대사 풀에서 무작위)
export function startLines(rng: Rng): DialogueLine[] {
  return [
    pick(rng, [
      { actor: 'beomtiger', text: '어흥! 이기면 명당은 내 거다!', emotion: 'joy' },
      { actor: 'beomtiger', text: '어디 한번 던져 보거라!', emotion: 'joy' },
      { actor: 'kkaki', text: '저 허풍쟁이 콧대를 꺾어줘요, 대장!', emotion: 'joy' },
      { actor: 'kkaki', text: '제가 훈수 넣을게요. 가보죠!', emotion: 'joy' },
    ] as DialogueLine[]),
  ];
}

export function endLines(winner: 'blue' | 'orange', rng: Rng): DialogueLine[] {
  if (winner === 'blue') {
    return [
      pick(rng, [
        { actor: 'kkaki', text: '이겼다! 대장 최고예요! 명당은 우리 거!', emotion: 'joy' },
        { actor: 'kkaki', text: '깍깍! 완승이에요, 대장!', emotion: 'joy' },
      ] as DialogueLine[]),
      pick(rng, [
        { actor: 'beomtiger', text: '으어어… 이 몸이 지다니! 한 판 더다!', emotion: 'anger' },
        { actor: 'ninetail', text: '어머… 계산이 어긋났네요. 다음엔 안 봐드려요.', emotion: 'anger' },
      ] as DialogueLine[]),
    ];
  }
  return [
    pick(rng, [
      { actor: 'beomtiger', text: '어흐하하! 이 몸의 승리다! 명당은 없던 일!', emotion: 'joy' },
      { actor: 'beomtiger', text: '봤느냐! 이것이 호랑이의 위엄이다!', emotion: 'joy' },
    ] as DialogueLine[]),
    pick(rng, [
      { actor: 'kkaki', text: '분해요… 대장, 한 판 더 해요. 네?', emotion: 'anger' },
      { actor: 'kkaki', text: '으으, 다음 판엔 꼭 갚아줘요!', emotion: 'anger' },
    ] as DialogueLine[]),
  ];
}

// 턴 오프닝 — 차례가 오면 캐릭터가 직접 알린다 (플레이어 턴은 깍이가 안내)
export function turnOpenLine(turnActor: ActorId, rng: Rng): DialogueLine {
  if (turnActor === 'player') {
    return {
      actor: 'kkaki',
      text: pick(rng, ['대장 차례예요!', '대장, 시원하게 던져요!', '자, 대장 차례! 가보죠!', '이번엔 대장이에요!']),
      emotion: 'joy',
    };
  }
  const pools: Record<string, string[]> = {
    kkaki: ['제 차례예요! 집중!', '깍깍, 이번엔 제가!', '제가 던질게요, 대장!'],
    beomtiger: ['이 몸의 차례다!', '어흥! 다들 비켜라!', '자, 이 몸이 간다!', '내 차례군. 각오해라!'],
    ninetail: ['제 차례네요, 후후.', '어디 볼까요…', '슬슬 제가 나설 차례죠.'],
  };
  return { actor: turnActor, text: pick(rng, pools[turnActor]), emotion: 'neutral' };
}

// 던지기 결과 리액션 — 던진 쪽이 결과에 한마디 (플레이어 턴은 깍이가 대신)
export function resultReactionLine(turnActor: ActorId, name: YutName, rng: Rng): DialogueLine {
  const speaker: ActorId = turnActor === 'player' ? 'kkaki' : turnActor;
  const grade = name === 'yut' || name === 'mo' ? 'good' : name === 'do' ? 'bad' : 'mid';
  const ko = YUT_KO[name];
  const pools: Record<string, Record<string, string[]>> = {
    kkaki: {
      good: [`${ko}!! 깍깍, 대박이에요!`, `${ko} 나왔어요! 한 번 더!`],
      mid: [`${ko}! 쏠쏠한데요?`, `${ko}이에요. 나쁘지 않아요!`],
      bad: [`${ko}… 으, 아쉽다!`, `${ko}네요. 다음에 만회해요!`],
    },
    beomtiger: {
      good: [`${ko}다!! 크하하!`, `봤느냐! ${ko}다!`],
      mid: [`${ko}인가. 뭐, 나쁘지 않군.`, `${ko}! 이 정도면 충분하지.`],
      bad: [`${ko}라니… 큼, 큼.`, `${ko}?! 가락이 잘못됐군!`],
    },
    ninetail: {
      good: [`어머, ${ko}네요. 후후.`, `${ko}. 계산대로예요.`],
      mid: [`${ko}. 예상 범위 안이죠.`, `${ko}이면 충분해요.`],
      bad: [`…${ko}. 못 본 걸로 하죠.`, `${ko}이라니, 어머.`],
    },
  };
  return {
    actor: speaker,
    text: pick(rng, pools[speaker][grade]),
    emotion: grade === 'good' ? 'joy' : grade === 'bad' ? (speaker === 'ninetail' ? 'surprise' : 'anger') : 'neutral',
  };
}

// 깍이 훈수(HINT) — 판단 AI가 계산한 최선 수의 유형별 폴백 대사
export type HintKind = 'capture' | 'goal' | 'stack' | 'shortcut' | 'advance';

export const HINT_DESC: Record<HintKind, string> = {
  capture: '상대 말을 잡을 수 있는 이동',
  goal: '말을 완주시키는 이동',
  stack: '아군 말을 업는 이동',
  shortcut: '지름길 모서리에 정확히 서는 이동',
  advance: '가장 유리한 전진',
};

export function hintFallback(kind: HintKind, rng: Rng): DialogueLine {
  const pools: Record<HintKind, string[]> = {
    capture: ['대장, 지금 잡을 수 있어요! 노란 칸이요!', '깍깍! 저 상대 말, 그대로 잡아버려요!'],
    goal: ['대장, 완주 각이에요! 내보내요!', '이번에 한 마리 들여보낼 수 있어요!'],
    stack: ['업고 가는 게 이득이에요, 대장!', '둘이 뭉치면 든든해요! 업어요!'],
    shortcut: ['모서리에 서면 지름길 탈 수 있어요!', '대장, 지름길 입구가 코앞이에요!'],
    advance: ['고민되면 앞선 말을 미는 게 좋아요!', '침착하게, 제일 앞 말을 밀어봐요!'],
  };
  return { actor: 'kkaki', text: pick(rng, pools[kind]), emotion: 'joy' };
}

/** 이벤트 → 프리셋 대사 (한 이벤트당 최대 2줄 — CONCEPT §6.2) */
export function linesForEvent(ev: GameEvent, rng: Rng): DialogueLine[] {
  switch (ev.type) {
    case 'YUT_MO': {
      const name = YUT_KO[ev.detail?.yutName ?? 'yut'];
      if (ev.team === 'blue') {
        const cheer = pick(rng, [
          { actor: 'kkaki', text: `${name}! ${name}이에요! 한 번 더 던져요!`, emotion: 'joy' },
          { actor: 'kkaki', text: `깍깍! ${name} 나왔어요! 기세 탔다!`, emotion: 'joy' },
        ] as DialogueLine[]);
        return rng() < 0.35
          ? [cheer, { actor: 'ninetail', text: '어머, 운이 좋으시네요. 아직은요.', emotion: 'neutral' }]
          : [cheer];
      }
      return [
        pick(rng, [
          { actor: ev.actor, text: `${name}다! 어흥, 막을 수 있겠느냐!`, emotion: 'joy' },
          { actor: ev.actor, text: `${name}! 후후, 계산대로예요.`, emotion: 'joy' },
        ] as DialogueLine[]),
      ];
    }
    case 'CAPTURE': {
      if (ev.team === 'blue') {
        return [
          pick(rng, [
            { actor: 'kkaki', text: '잡았다! 대장, 완벽했어요!', emotion: 'joy' },
            { actor: 'kkaki', text: '깍깍! 그대로 접수! 한 번 더예요!', emotion: 'joy' },
          ] as DialogueLine[]),
          pick(rng, [
            { actor: 'beomtiger', text: '뭐, 뭐라?! 이 몸의 말이! 으어어!', emotion: 'anger' },
            { actor: 'ninetail', text: '…방금 건 계산에 없었는데요.', emotion: 'surprise' },
          ] as DialogueLine[]),
        ];
      }
      return [
        pick(rng, [
          { actor: ev.actor, text: '어흥! 그 말은 이 몸이 접수한다!', emotion: 'joy' },
          { actor: ev.actor, text: '어머, 잡아먹는다고 말씀드렸잖아요?', emotion: 'joy' },
        ] as DialogueLine[]),
        pick(rng, [
          { actor: 'kkaki', text: '아앗! 대장, 우리 말이…! 두고 봐요!', emotion: 'anger' },
          { actor: 'kkaki', text: '으으, 분해! 꼭 갚아줄 거예요!', emotion: 'anger' },
        ] as DialogueLine[]),
      ];
    }
    case 'STACK': {
      if (ev.team === 'blue') {
        return [
          pick(rng, [
            { actor: 'kkaki', text: '든든하게 업고 갑니다, 대장!', emotion: 'joy' },
            { actor: 'kkaki', text: '둘이 함께면 두 배로 빨라요!', emotion: 'joy' },
          ] as DialogueLine[]),
        ];
      }
      return [
        pick(rng, [
          { actor: ev.actor, text: '업고 간다! 어흥, 두 배로 무섭지!', emotion: 'joy' },
          { actor: ev.actor, text: '함께 가면 효율이 두 배랍니다.', emotion: 'neutral' },
        ] as DialogueLine[]),
      ];
    }
    case 'FINISH': {
      if (ev.team === 'blue') {
        return [{ actor: 'kkaki', text: '한 마리 완주! 순항 중이에요, 대장!', emotion: 'joy' }];
      }
      return [{ actor: ev.actor, text: '먼저 한 발 완주다! 어흥!', emotion: 'joy' }];
    }
    case 'LEAD_CHANGE': {
      if (ev.detail?.newLeader === 'blue') {
        return [
          { actor: 'kkaki', text: '역전이에요! 이대로 밀어붙여요!', emotion: 'joy' },
          { actor: 'ninetail', text: '…어머. 판이 기울었네요. 정비하죠.', emotion: 'surprise' },
        ];
      }
      return [
        { actor: 'beomtiger', text: '어흐하하! 다시 이 몸이 앞선다!', emotion: 'joy' },
        { actor: 'kkaki', text: '아직 몰라요! 윷판은 끝까지 가봐야죠!', emotion: 'anger' },
      ];
    }
    case 'GAME_END':
      return endLines(ev.detail?.winner ?? 'blue', rng);
    case 'GAME_START':
      return startLines(rng);
  }
}
