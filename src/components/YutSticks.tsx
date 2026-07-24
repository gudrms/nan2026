import type { YutThrow, YutName } from '../game/throwYut';

// 윷 던지기 결과 표시 — 가락 4개의 앞/뒤 상태를 그대로 연출에 재사용 (디자인 시스템 §04)

const YUT_KO: Record<YutName, string> = { do: '도', gae: '개', geol: '걸', yut: '윷', mo: '모' };

function Stick({ flat }: { flat: boolean }) {
  return flat ? (
    <div
      style={{
        width: 22,
        height: 84,
        borderRadius: 11,
        background: 'var(--wood-light)',
        border: '2px solid var(--wood)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--wood)',
        fontWeight: 800,
        fontSize: 11,
      }}
    >
      <span>✕</span>
      <span>✕</span>
      <span>✕</span>
    </div>
  ) : (
    <div
      style={{
        width: 22,
        height: 84,
        borderRadius: 11,
        background: 'var(--wood)',
        border: '2px solid #6e4522',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 4,
          top: 9,
          bottom: 9,
          width: 3.5,
          borderRadius: 2,
          background: 'rgba(251,247,236,.35)',
        }}
      />
    </div>
  );
}

export default function YutSticks({ yut }: { yut: YutThrow | null }) {
  if (!yut) return <div style={{ height: 108 }} />;
  return (
    <div className="pop-in" style={{ height: 108, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {yut.sticks.map((flat, i) => (
          <Stick key={i} flat={flat} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: yut.bonus ? 'var(--red)' : 'var(--ink)' }}>
          {YUT_KO[yut.name]}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: yut.bonus ? 'var(--red)' : 'var(--text-sub)' }}>
          {yut.steps}칸{yut.bonus && ' · 한 번 더!'}
        </div>
      </div>
    </div>
  );
}
