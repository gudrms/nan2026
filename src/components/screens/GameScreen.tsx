import { useEffect, useState } from 'react';
import { useGame } from '../../hooks/useGame';
import { sfxResult } from '../../audio/sfx';
import { setBgmMode, startBgm, stopBgm } from '../../audio/bgm';
import { type ActorId, type TeamId } from '../../game/state';
import Board from '../Board';
import Character from '../Character';
import SpeechBubble from '../SpeechBubble';
import TeamPanel from '../TeamPanel';
import YutSticks from '../YutSticks';

const NAME_KO: Record<ActorId, string> = {
  player: '도령',
  kkaki: '까비',
  beomtiger: '범이',
  ninetail: '여울',
};

// 좌우 팀 배치: 적팀 좌 / 아군 우 (CONCEPT §7.2, 기획 피드백 F-3·4)
const LEFT_SIDE: ActorId[] = ['beomtiger', 'ninetail'];
const RIGHT_SIDE: ActorId[] = ['kkaki', 'player'];
const RESULT_DELAY_MS = 3400;
const TOSS_MS = 700; // 가락 토스 연출 시간 — 이후 결과 공개 (F-5)

export default function GameScreen({ onGameEnd }: { onGameEnd: (winner: TeamId) => void }) {
  const {
    state,
    actor,
    bubbles,
    muted,
    toggleMute,
    lastMove,
    hintMove,
    moods,
    extraTurn,
    playerCanThrow,
    playerCanMove,
    selectableMoves,
    playerThrow,
    playerSelect,
  } = useGame();

  // 배경음악 (I-3): 기본 루프 ↔ 플레이어 차례엔 빠른 패턴
  useEffect(() => {
    startBgm();
    return () => stopBgm();
  }, []);
  useEffect(() => {
    setBgmMode(actor === 'player' && state.phase !== 'finished' ? 'player' : 'base');
  }, [actor, state.phase]);

  // 던지기 결과는 토스 연출 후 공개 — 그 전에는 이동 선택도 잠근다
  const [resultShown, setResultShown] = useState(false);
  useEffect(() => {
    if (!state.pendingThrow) {
      setResultShown(false);
      return;
    }
    setResultShown(false);
    const yut = state.pendingThrow;
    const t = setTimeout(() => {
      setResultShown(true);
      sfxResult(yut.steps, yut.bonus);
    }, TOSS_MS);
    return () => clearTimeout(t);
  }, [state.pendingThrow]);

  useEffect(() => {
    if (state.phase !== 'finished' || !state.winner) return;
    const t = setTimeout(() => onGameEnd(state.winner as TeamId), RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.phase, state.winner, onGameEnd]);

  const turnLabel =
    state.phase === 'finished'
      ? state.winner === 'blue'
        ? '우리 팀 승리!'
        : '상대 팀 승리!'
      : `${NAME_KO[actor]}의 차례${extraTurn ? ' — 한 번 더!' : ''}`;

  const renderChar = (a: ActorId) => {
    const bubble = bubbles.find((b) => b.actor === a);
    const isActive = state.phase !== 'finished' && a === actor;
    return (
      <div key={a} className="char-block">
        {bubble && (
          <div className="char-bubble">
            <SpeechBubble actor={a} text={bubble.text} revealMs={bubble.revealMs} />
          </div>
        )}
        {isActive && <div className="turn-marker">▼</div>}
        <div
          className={isActive ? 'turn-bob' : undefined}
          style={{ opacity: isActive || bubble ? 1 : 0.72, transition: 'opacity .3s' }}
        >
          <Character
            actor={a}
            width={96}
            emotion={bubble?.emotion ?? moods[a]}
            talking={!!bubble}
            active={isActive}
          />
        </div>
        <div className={`name-pill${isActive ? ' active' : ''}`}>{NAME_KO[a]}</div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="obang-strip">
        <div style={{ background: 'var(--blue)' }} />
        <div style={{ background: 'var(--red)' }} />
        <div style={{ background: 'var(--gold)' }} />
        <div style={{ background: 'var(--paper)' }} />
        <div style={{ background: 'var(--ink)' }} />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px 18px',
          maxWidth: 920,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* 상단: 턴 표시 + 음소거 */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            background: 'var(--ink)',
            color: 'var(--paper)',
            fontWeight: 700,
            fontSize: 14,
            padding: '8px 18px',
            borderRadius: 999,
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--gold)' }} />
          {turnLabel}
          <button
            onClick={toggleMute}
            title={muted ? '소리 켜기' : '소리 끄기'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--paper)',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </span>

        <div className="game-layout">
          {/* 적팀 (좌) */}
          <div className="team-side orange">
            <TeamPanel team="orange" mals={state.mals} />
            <div className="side-spacer" />
            {LEFT_SIDE.map(renderChar)}
          </div>

          {/* 중앙: 윷판 + 던지기 결과 오버레이 + 조작 */}
          <div className="board-cell">
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <Board
                state={state}
                selectable={resultShown ? selectableMoves : []}
                onSelect={playerSelect}
                lastMove={lastMove}
                hintMove={hintMove}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '13%',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <YutSticks yut={state.pendingThrow} revealed={resultShown} />
              </div>
            </div>
            <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {playerCanThrow ? (
                <button className="btn-primary" onClick={playerThrow}>
                  윷 던지기!
                </button>
              ) : playerCanMove && resultShown ? (
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--red)' }}>
                  움직일 칸을 골라주세요!
                </div>
              ) : state.phase !== 'finished' ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {NAME_KO[actor]}, 고민 중…
                </div>
              ) : null}
            </div>
          </div>

          {/* 아군 (우) */}
          <div className="team-side blue">
            <TeamPanel team="blue" mals={state.mals} />
            <div className="side-spacer" />
            {RIGHT_SIDE.map(renderChar)}
          </div>
        </div>
      </div>
    </div>
  );
}
