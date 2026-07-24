import type { ReactNode } from 'react';
import type { ActorId } from '../game/state';
import type { Emotion } from '../ai/presetLines';

// 디자인 시스템 §03 캐릭터 SVG 이식 (docs/design/design-system.dc.html).
// 2.5px 먹선 + 플랫 채색, 표정 4상태 공유. 말할 때는 입 2상태를 CSS로 번갈아 표시.

const INK = '#2a2722';
const HANJI = '#fbf7ec';
const BLUE = '#2c5fa8';
const RED = '#be3a2b';
const GOLD = '#e9b94c';
const TIG = '#e8933a';
const FOX = '#d96635';
const SKIN = '#f3cfa6';

type Kind = 'kkaki' | 'tiger' | 'fox' | 'player';
const KIND_OF: Record<ActorId, Kind> = { kkaki: 'kkaki', beomtiger: 'tiger', ninetail: 'fox', player: 'player' };

function head(kind: Kind): ReactNode[] {
  switch (kind) {
    case 'kkaki':
      return [
        <path key="t" d="M34 26 Q26 12 40 16 Q35 22 40 27 Z" fill={BLUE} stroke={INK} strokeWidth={2} />,
        <circle key="h" cx={50} cy={52} r={33} fill={INK} />,
        <ellipse key="f" cx={50} cy={61} rx={23} ry={18} fill={HANJI} />,
      ];
    case 'tiger':
      return [
        <circle key="e1" cx={29} cy={24} r={10} fill={TIG} stroke={INK} strokeWidth={2.5} />,
        <circle key="e2" cx={71} cy={24} r={10} fill={TIG} stroke={INK} strokeWidth={2.5} />,
        <circle key="h" cx={50} cy={52} r={33} fill={TIG} stroke={INK} strokeWidth={2.5} />,
        <path key="s" d="M50 23 v10 M41 25 l4 9 M59 25 l-4 9" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />,
        <path key="c1" d="M18 46 h7 M18 54 h6" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />,
        <path key="c2" d="M82 46 h-7 M82 54 h-6" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />,
        <ellipse key="m" cx={50} cy={64} rx={16} ry={12} fill={HANJI} />,
        <path key="n" d="M46 58 h8 l-4 5 Z" fill={INK} />,
      ];
    case 'fox':
      return [
        <path key="e1" d="M20 38 L30 10 L44 32 Z" fill={FOX} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />,
        <path key="e2" d="M80 38 L70 10 L56 32 Z" fill={FOX} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />,
        <path key="i1" d="M27 30 L31 19 L37 28 Z" fill={HANJI} />,
        <path key="i2" d="M73 30 L69 19 L63 28 Z" fill={HANJI} />,
        <circle key="h" cx={50} cy={52} r={33} fill={FOX} stroke={INK} strokeWidth={2.5} />,
        <ellipse key="m" cx={50} cy={64} rx={15} ry={11} fill={HANJI} />,
        <path key="n" d="M46 59 h8 l-4 5 Z" fill={INK} />,
      ];
    case 'player':
      return [
        <circle key="h" cx={50} cy={52} r={33} fill={SKIN} stroke={INK} strokeWidth={2.5} />,
        <path key="hair" d="M17 50 A33 33 0 0 1 83 50 Q73 37 50 36 Q27 37 17 50 Z" fill={INK} />,
        <circle key="bun" cx={50} cy={15} r={7} fill={INK} />,
      ];
  }
}

function eyes(emo: Emotion): ReactNode[] {
  switch (emo) {
    case 'joy':
      return [
        <path key="ey" d="M32 49 Q37 43 42 49 M58 49 Q63 43 68 49" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />,
        <ellipse key="b1" cx={28} cy={58} rx={5} ry={3.4} fill="#f0a28e" opacity={0.75} />,
        <ellipse key="b2" cx={72} cy={58} rx={5} ry={3.4} fill="#f0a28e" opacity={0.75} />,
      ];
    case 'anger':
      return [
        <path key="br" d="M30 41 L43 46 M70 41 L57 46" stroke={INK} strokeWidth={3} strokeLinecap="round" />,
        <circle key="e1" cx={37} cy={50} r={3.2} fill={INK} />,
        <circle key="e2" cx={63} cy={50} r={3.2} fill={INK} />,
      ];
    case 'surprise':
      return [
        <circle key="w1" cx={37} cy={49} r={6} fill="#fff" stroke={INK} strokeWidth={2.2} />,
        <circle key="w2" cx={63} cy={49} r={6} fill="#fff" stroke={INK} strokeWidth={2.2} />,
        <circle key="p1" cx={37} cy={49} r={2.4} fill={INK} />,
        <circle key="p2" cx={63} cy={49} r={2.4} fill={INK} />,
      ];
    default:
      return [
        <circle key="e1" cx={37} cy={49} r={3.2} fill={INK} />,
        <circle key="e2" cx={63} cy={49} r={3.2} fill={INK} />,
      ];
  }
}

/** 입/부리 — open은 말하는 중 프레임으로도 사용 */
function mouth(kind: Kind, emo: Emotion, open: boolean): ReactNode {
  if (kind === 'kkaki') {
    if (open || emo === 'surprise')
      return <path d="M50 60 L42 66 L50 72 L58 66 Z" fill={GOLD} stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
    if (emo === 'joy')
      return <path d="M42 63 L58 63 L50 71 Z M44 66 Q50 62 56 66" fill={GOLD} stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
    return <path d="M42 64 L58 64 L50 71 Z" fill={GOLD} stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
  }
  if (open || emo === 'surprise') return <ellipse cx={50} cy={70} rx={4} ry={5.5} fill={INK} />;
  if (emo === 'joy') return <path d="M42 64 Q50 74 58 64 Z" fill={INK} />;
  if (emo === 'anger') return <path d="M44 72 Q50 66 56 72" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />;
  return <path d="M44 68 Q50 72 56 68" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />;
}

function face(kind: Kind, emo: Emotion, talking: boolean): ReactNode {
  return (
    <>
      {head(kind)}
      {eyes(emo)}
      {talking ? (
        <>
          <g className="mouth-talk-a">{mouth(kind, emo, false)}</g>
          <g className="mouth-talk-b">{mouth(kind, emo, true)}</g>
        </>
      ) : (
        mouth(kind, emo, false)
      )}
    </>
  );
}

function body(kind: Kind): ReactNode[] {
  switch (kind) {
    case 'kkaki':
      return [
        <path key="tail" d="M96 172 L146 196 L100 152 Z" fill={INK} />,
        <ellipse key="bd" cx={78} cy={158} rx={42} ry={48} fill={INK} />,
        <ellipse key="be" cx={74} cy={168} rx={23} ry={28} fill={HANJI} />,
        <ellipse key="wg" cx={112} cy={150} rx={11} ry={26} fill={BLUE} stroke={INK} strokeWidth={2} transform="rotate(-16 112 150)" />,
        <path key="ft" d="M62 204 v9 M57 213 h11 M90 204 v9 M85 213 h11" stroke="#d98e32" strokeWidth={3.5} strokeLinecap="round" />,
      ];
    case 'tiger':
      return [
        <path key="tail" d="M126 182 q28 -6 22 -30" stroke={TIG} strokeWidth={9} strokeLinecap="round" fill="none" />,
        <circle key="tt" cx={148} cy={150} r={6} fill={INK} />,
        <ellipse key="bd" cx={80} cy={160} rx={47} ry={48} fill={TIG} stroke={INK} strokeWidth={2.5} />,
        <ellipse key="be" cx={80} cy={170} rx={25} ry={28} fill={HANJI} />,
        <path key="s1" d="M38 138 q9 7 7 16 M122 138 q-9 7 -7 16 M35 172 h10 M125 172 h-10" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />,
        <ellipse key="f1" cx={58} cy={207} rx={13} ry={8} fill={TIG} stroke={INK} strokeWidth={2.5} />,
        <ellipse key="f2" cx={102} cy={207} rx={13} ry={8} fill={TIG} stroke={INK} strokeWidth={2.5} />,
      ];
    case 'fox':
      return [
        <ellipse key="t1" cx={124} cy={146} rx={17} ry={42} fill={FOX} stroke={INK} strokeWidth={2.5} transform="rotate(-30 124 146)" />,
        <ellipse key="t1t" cx={140} cy={116} rx={9} ry={13} fill={HANJI} stroke={INK} strokeWidth={2} transform="rotate(-30 140 116)" />,
        <ellipse key="t2" cx={132} cy={176} rx={12} ry={30} fill={FOX} stroke={INK} strokeWidth={2.5} transform="rotate(-62 132 176)" />,
        <ellipse key="bd" cx={74} cy={162} rx={41} ry={46} fill={FOX} stroke={INK} strokeWidth={2.5} />,
        <ellipse key="be" cx={72} cy={172} rx={22} ry={26} fill={HANJI} />,
        <ellipse key="f1" cx={56} cy={207} rx={11} ry={7} fill={INK} />,
        <ellipse key="f2" cx={94} cy={207} rx={11} ry={7} fill={INK} />,
      ];
    case 'player':
      return [
        <path key="jk" d="M42 118 Q80 106 118 118 L126 168 Q80 180 34 168 Z" fill={HANJI} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />,
        <path key="cl" d="M64 112 L80 142 L96 112" stroke={BLUE} strokeWidth={7} fill="none" strokeLinecap="round" />,
        <path key="rb" d="M80 142 q-8 14 1 26" stroke={RED} strokeWidth={5} fill="none" strokeLinecap="round" />,
        <path key="pt" d="M40 164 Q80 154 120 164 L128 206 Q80 218 32 206 Z" fill={BLUE} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />,
        <ellipse key="f1" cx={58} cy={212} rx={12} ry={6} fill={INK} />,
        <ellipse key="f2" cx={102} cy={212} rx={12} ry={6} fill={INK} />,
      ];
  }
}

export interface CharacterProps {
  actor: ActorId;
  emotion?: Emotion;
  talking?: boolean;
  width?: number;
  /** 현재 턴 하이라이트 */
  active?: boolean;
}

export default function Character({ actor, emotion = 'neutral', talking = false, width = 120, active = false }: CharacterProps) {
  const kind = KIND_OF[actor];
  const headY = kind === 'player' ? 18 : 22;
  return (
    <svg
      width={width}
      height={Math.round((width * 220) / 160)}
      viewBox="0 0 160 220"
      style={{
        filter: active ? 'drop-shadow(0 0 10px rgba(233,185,76,.85))' : undefined,
        transition: 'filter .25s, transform .25s',
        transform: active ? 'scale(1.05)' : undefined,
      }}
    >
      {body(kind)}
      <g transform={`translate(30,${headY})`}>{face(kind, emotion, talking)}</g>
    </svg>
  );
}
