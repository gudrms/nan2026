import type { ActorId } from '../game/state';
import type { Emotion } from '../ai/presetLines';
import magpieIdle from '../assets/characters/magpie-idle.png';
import magpieTalk from '../assets/characters/magpie-talk-breathe.gif';
import magpieJoy from '../assets/characters/magpie-joy.png';
import magpieAnger from '../assets/characters/magpie-anger.png';
import magpieSurprise from '../assets/characters/magpie-surprise.png';
import tigerIdle from '../assets/characters/tiger-idle.png';
// 입이 벌어짐↔O자만 반복하는 talk 전용 루프 — 다문 입 정지 프레임이 없어 idle에는 부적합
import tigerTalk from '../assets/characters/tiger-talk-breathe.gif';
import tigerJoy from '../assets/characters/tiger-joy.png';
import tigerAnger from '../assets/characters/tiger-anger.png';
import tigerSurprise from '../assets/characters/tiger-surprise.png';
import foxIdle from '../assets/characters/fox-idle.png';
import foxTalk from '../assets/characters/fox-talk-breathe.gif';
import foxJoy from '../assets/characters/fox-joy.png';
import foxAnger from '../assets/characters/fox-anger.png';
import foxSurprise from '../assets/characters/fox-surprise.png';
import playerIdle from '../assets/characters/player-idle.png';
import playerTalk from '../assets/characters/player-talk-breathe.gif';
import playerJoy from '../assets/characters/player-joy.png';
import playerAnger from '../assets/characters/player-anger.png';
import playerSurprise from '../assets/characters/player-surprise.png';

// 기획 제작 캐릭터 이미지 (ADR-003): idle/talk + emotion(joy/anger/surprise) 정지 이미지.
// talk GIF는 neutral 표정 기준 1종뿐이라, 발화 중 emotion 표시는 이모지 배지로 보완한다.

const ART: Record<ActorId, { idle: string; talk: string; joy: string; anger: string; surprise: string }> = {
  kkaki: { idle: magpieIdle, talk: magpieTalk, joy: magpieJoy, anger: magpieAnger, surprise: magpieSurprise },
  beomtiger: { idle: tigerIdle, talk: tigerTalk, joy: tigerJoy, anger: tigerAnger, surprise: tigerSurprise },
  ninetail: { idle: foxIdle, talk: foxTalk, joy: foxJoy, anger: foxAnger, surprise: foxSurprise },
  player: { idle: playerIdle, talk: playerTalk, joy: playerJoy, anger: playerAnger, surprise: playerSurprise },
};

// talk GIF는 idle PNG보다 캔버스 안에서 캐릭터가 더 넓게 그려져 있다 — 같은 96px 박스에
// 넣어도 발화 시작 순간 확 커진 것처럼 보인다(여울·까비·도령, 실측 콘텐츠 높이 기준 최대 +23%).
// 범이만 idle·talk 크롭이 거의 같아 보정이 필요 없다. idle/talk 높이 비율로 역보정.
const TALK_SCALE: Record<ActorId, number> = {
  kkaki: 0.81,
  beomtiger: 1,
  ninetail: 0.85,
  player: 0.89,
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
  // 발화 중엔 talk GIF(호흡·입 움직임) 우선 — emotion 정지 이미지와 talking을 겸한 에셋은 없음
  const src = talking ? art.talk : emotion === 'neutral' ? art.idle : art[emotion];
  // talking 중에는 emotion이 이미지에 반영되지 않으므로 배지로 보완
  const badge = talking ? EMO_BADGE[emotion] : null;
  const talkScale = talking ? TALK_SCALE[actor] : 1;
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: width }}>
      {/* talk 보정 스케일 전용 래퍼 — 발끝(하단) 기준으로 축소해야 서 있는 자세가 안 뜬다.
          active 강조 스케일과 origin이 달라(하나는 하단, 하나는 중앙) 중첩을 위해 감싼다 */}
      <div style={{ transform: talkScale !== 1 ? `scale(${talkScale})` : undefined, transformOrigin: 'center bottom' }}>
        <img
          src={src}
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
      </div>
      {badge && (
        // key로 emotion 변경 시마다 팝인 재생
        <span key={emotion} className="emo-badge" aria-hidden>
          {badge}
        </span>
      )}
    </div>
  );
}
