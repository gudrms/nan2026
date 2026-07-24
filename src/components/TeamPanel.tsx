import type { Mal, TeamId } from '../game/state';

// 팀 정보 패널 — 채운 점 = 판 위 말, 점선 점 = 출발 전, 완주 N (디자인 시스템 §07)

export default function TeamPanel({ team, mals }: { team: TeamId; mals: Mal[] }) {
  const own = mals.filter((m) => m.team === team);
  const goal = own.filter((m) => m.pos === 'goal').length;
  const color = team === 'blue' ? 'var(--blue)' : 'var(--orange)';
  return (
    <div
      style={{
        border: `2.5px solid ${color}`,
        borderRadius: 14,
        background: '#fff',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color }}>
        {team === 'blue' ? '우리 팀' : '상대 팀'}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {own
          .filter((m) => m.pos !== 'goal')
          .map((m) => (
            <div
              key={m.id}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: m.pos === 'ready' ? 'var(--line)' : color,
                border: m.pos === 'ready' ? '2px dashed var(--text-muted)' : '2px solid var(--ink)',
              }}
            />
          ))}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-sub)' }}>완주 {goal}</span>
    </div>
  );
}
