import Character from '../Character';
import type { TeamId } from '../../game/state';

export default function ResultScreen({
  winner,
  onRestart,
  onHome,
}: {
  winner: TeamId;
  onRestart: () => void;
  onHome: () => void;
}) {
  const win = winner === 'blue';
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
          gap: 24,
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 48px)', color: win ? 'var(--blue)' : 'var(--red)' }}>
          {win ? '우리 팀 승리!' : '상대 팀 승리…'}
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.6 }}>
          {win
            ? '허풍쟁이 호랑이를 꺾고 병풍 속 최고 명당을 차지했다!'
            : '범발톱이 포효한다. "어흐하하! 명당은 없던 일이다!" — 이대로 물러날 순 없지.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px, 2vw, 20px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Character actor="beomtiger" emotion={win ? 'anger' : 'joy'} width={108} />
          <Character actor="ninetail" emotion={win ? 'anger' : 'joy'} width={94} />
          <Character actor="kkaki" emotion={win ? 'joy' : 'anger'} width={94} />
          <Character actor="player" emotion={win ? 'joy' : 'anger'} width={108} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" onClick={onRestart}>
            한 판 더!
          </button>
          <button className="btn-secondary" onClick={onHome}>
            처음으로
          </button>
        </div>
      </main>
    </div>
  );
}
