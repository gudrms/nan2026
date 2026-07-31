import type { ActorId } from '../game/state';
import type { Emotion } from '../ai/presetLines';
import magpieIdle from '../assets/characters/magpie-idle.png';
import magpieTalk from '../assets/characters/magpie-talk-breathe.gif';
import tigerIdle from '../assets/characters/tiger-idle.png';
import tigerTalk from '../assets/characters/tiger-talk-breathe.gif';
import foxIdle from '../assets/characters/fox-idle.png';
import foxTalk from '../assets/characters/fox-talk-breathe.gif';
import playerIdle from '../assets/characters/player-idle.png';
import playerTalk from '../assets/characters/player-talk-breathe.gif';

// 기획 제작 캐릭터 이미지 (ADR-003): 기본=idle PNG, 발화 중=talk GIF.
// emotion 4종(LLM emotion → 표정 구동)은 emotion별 이미지가 나올 때까지 이모지 오버레이로 유지.

const ART: Record<ActorId, { idle: string; talk: string }> = {
  kkaki: { idle: magpieIdle, talk: magpieTalk },
  beomtiger: { idle: tigerIdle, talk: tigerTalk },
  ninetail: { idle: foxIdle, talk: foxTalk },
  player: { idle: playerIdle, talk: playerTalk },
};

const EMO_BADGE: Record<Emotion, string | null> = {
  neutral: null,
  joy: '✨',
  anger: '💢',
  surprise: '❗',
};

export interface CharacterProps {
  actor: ActorId;
  emotion?: Emotion;
  talking?: boolean;
  width?: number;
  /** 현재 턴 하이라이트 */
  active?: boolean;
}

export default function Character({ actor, emotion = 'neutral', talking = false, width = 120, active = false }: CharacterProps) {
  const art = ART[actor];
  const badge = EMO_BADGE[emotion];
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: width }}>
      <img
        src={talking ? art.talk : art.idle}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          filter: active ? 'drop-shadow(0 0 10px rgba(233,185,76,.85))' : undefined,
          transition: 'filter .25s, transform .25s',
          transform: active ? 'scale(1.05)' : undefined,
        }}
      />
      {badge && (
        // key로 emotion 변경 시마다 팝인 재생
        <span key={emotion} className="emo-badge" aria-hidden>
          {badge}
        </span>
      )}
    </div>
  );
}
