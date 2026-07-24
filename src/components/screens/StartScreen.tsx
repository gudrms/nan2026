import Character from '../Character';

const STORY = [
  '설날 아침, 민화 병풍 속 동물들이 마당으로 튀어나와 윷판을 폈다.',
  '허세 대장 호랑이가 외친다. "이 몸을 이기면 병풍 속 최고 명당을 내주지!"',
  '영리한 까치가 당신 어깨에 내려앉는다. "저 허풍쟁이, 우리가 혼내주자!"',
];

export default function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="obang-strip">
        <div style={{ background: 'var(--blue)' }} />
        <div style={{ background: 'var(--red)' }} />
        <div style={{ background: 'var(--gold)' }} />
        <div style={{ background: 'var(--paper)' }} />
        <div style={{ background: 'var(--ink)' }} />
      </div>
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 26,
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 'clamp(34px, 7vw, 56px)', lineHeight: 1.15 }}>
          윷놀이: <span style={{ color: 'var(--red)' }}>까치호랑이</span> 한판
        </h1>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px, 2vw, 20px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Character actor="beomtiger" emotion="joy" width={110} />
          <Character actor="ninetail" width={96} />
          <Character actor="kkaki" emotion="joy" width={96} />
          <Character actor="player" width={110} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-sub)', fontSize: 15.5, lineHeight: 1.6 }}>
          {STORY.map((line) => (
            <p key={line} style={{ margin: 0 }}>
              {line}
            </p>
          ))}
        </div>
        <button className="btn-primary" onClick={onStart}>
          윷놀이 시작!
        </button>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          말하는 AI 친구들과 함께하는 2 vs 2 전통 윷놀이
        </p>
      </main>
    </div>
  );
}
