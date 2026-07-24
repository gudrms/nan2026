import { ACTOR_TEAM, type ActorId } from '../game/state';

const NAME_KO: Record<ActorId, string> = {
  player: '플레이어',
  kkaki: '깍이',
  beomtiger: '범발톱',
  ninetail: '꼬리아홉',
};

export default function SpeechBubble({ actor, text }: { actor: ActorId; text: string }) {
  const team = ACTOR_TEAM[actor];
  return (
    <div
      className="bubble-in"
      style={{
        position: 'relative',
        background: '#fff',
        border: '2.5px solid var(--ink)',
        borderRadius: 14,
        padding: '12px 14px 10px',
        maxWidth: 230,
        minWidth: 120,
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
      <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.4 }}>{text}</div>
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
