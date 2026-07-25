import { useEffect, useState } from 'react';
import { ACTOR_TEAM, type ActorId } from '../game/state';

const NAME_KO: Record<ActorId, string> = {
  player: '플레이어',
  kkaki: '깍이',
  beomtiger: '범발톱',
  ninetail: '꼬리아홉',
};

interface SpeechBubbleProps {
  actor: ActorId;
  text: string;
  /** 타자기 시작 여부 — 시작 전엔 "…" 표시 (음성 대기) */
  typing?: boolean;
  /** 전체 텍스트가 드러나는 시간(ms) — 음성 길이에 맞춘 페이스 (F-2) */
  revealMs?: number;
}

export default function SpeechBubble({ actor, text, typing = true, revealMs }: SpeechBubbleProps) {
  const team = ACTOR_TEAM[actor];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!typing) {
      setShown(0);
      return;
    }
    // 경과 시간 기반 — 백그라운드 탭 타이머 스로틀에도 진행 속도가 유지된다
    const total = text.length;
    const perChar = Math.max(18, (revealMs ?? total * 45) / Math.max(total, 1));
    const start = Date.now();
    const tick = () => setShown(Math.min(total, Math.floor((Date.now() - start) / perChar) + 1));
    tick();
    const timer = setInterval(tick, Math.max(30, perChar));
    return () => clearInterval(timer);
  }, [typing, text, revealMs]);

  return (
    <div
      className="bubble-in"
      style={{
        position: 'relative',
        background: '#fff',
        border: '2.5px solid var(--ink)',
        borderRadius: 14,
        padding: '10px 12px 9px',
        maxWidth: '100%',
        minWidth: 90,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: -12,
          left: 12,
          background: team === 'blue' ? 'var(--blue)' : 'var(--orange)',
          color: 'var(--paper)',
          fontSize: 12,
          fontWeight: 800,
          padding: '2px 11px',
          borderRadius: 999,
          border: '2px solid var(--ink)',
          whiteSpace: 'nowrap',
        }}
      >
        {NAME_KO[actor]}
      </span>
      {/* 전체 텍스트로 크기를 고정해두고 위에 타자기 텍스트를 얹는다 (풍선 크기 흔들림 방지) */}
      <div style={{ position: 'relative', fontWeight: 700, fontSize: 14.5, lineHeight: 1.4 }}>
        <span style={{ visibility: 'hidden' }}>{text}</span>
        <span style={{ position: 'absolute', inset: 0 }}>{typing ? text.slice(0, shown) : '…'}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          left: 30,
          width: 16,
          height: 16,
          background: '#fff',
          borderRight: '2.5px solid var(--ink)',
          borderBottom: '2.5px solid var(--ink)',
          transform: 'rotate(45deg)',
        }}
      />
    </div>
  );
}
