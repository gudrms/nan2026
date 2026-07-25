import type { YutThrow, YutName } from '../game/throwYut';

// 윷 던지기 결과 — 윷판 위 오버레이 카드로 표시 (가락 4개의 앞/뒤 상태 재사용, 디자인 시스템 §04)

const YUT_KO: Record<YutName, string> = { do: '도', gae: '개', geol: '걸', yut: '윷', mo: '모' };

function Stick({ flat }: { flat: boolean }) {
  return flat ? (
    <div
      style={{
        width: 15,
        height: 56,
        borderRadius: 8,
        background: 'var(--wood-light)',
        border: '2px solid var(--wood)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        color: 'var(--wood)',
        fontWeight: 800,
        fontSize: 8,
      }}
    >
      <span>✕</span>
      <span>✕</span>
      <span>✕</span>
    </div>
  ) : (
    <div
      style={{
        width: 15,
        height: 56,
        borderRadius: 8,
        background: 'var(--wood)',
        border: '2px solid #6e4522',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 3,
          top: 7,
          bottom: 7,
          width: 2.5,
          borderRadius: 2,
          background: 'rgba(251,247,236,.35)',
        }}
      />
    </div>
  );
}

export default function YutSticks({ yut, revealed }: { yut: YutThrow | null; revealed: boolean }) {
  if (!yut) return null;
  if (!revealed) {
    // 토스 연출 (F-5): 가락 4개가 회전하며 떠올랐다 떨어진다
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 120 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stick-toss" style={{ animationDelay: `${i * 0.05}s` }}>
            <Stick flat={false} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className="pop-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(251,247,236,.94)',
        border: '2.5px solid var(--ink)',
        borderRadius: 14,
        padding: '10px 16px',
        boxShadow: '0 4px 0 rgba(42,39,34,.25)',
      }}
    >
      <div style={{ display: 'flex', gap: 5 }}>
        {yut.sticks.map((flat, i) => (
          <Stick key={i} flat={flat} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.1, color: yut.bonus ? 'var(--red)' : 'var(--ink)' }}>
          {YUT_KO[yut.name]}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: yut.bonus ? 'var(--red)' : 'var(--text-sub)' }}>
          {yut.steps}칸{yut.bonus && ' · 한 번 더!'}
        </div>
      </div>
    </div>
  );
}
