import { useEffect } from 'react';
import { useGame } from '../../hooks/useGame';
import { ACTOR_TEAM, type ActorId, type TeamId } from '../../game/state';
import Board from '../Board';
import Character from '../Character';
import SpeechBubble from '../SpeechBubble';
import TeamPanel from '../TeamPanel';
import YutSticks from '../YutSticks';

const NAME_KO: Record<ActorId, string> = {
  player: '플레이어',
  kkaki: '깍이',
  beomtiger: '범발톱',
  ninetail: '꼬리아홉',
};

// 캐릭터 스탠딩 배치: 적팀 좌 / 아군 우 (CONCEPT §7.2)
const STANDING_ORDER: ActorId[] = ['beomtiger', 'ninetail', 'kkaki', 'player'];
const RESULT_DELAY_MS = 3400;

export default function GameScreen({ onGameEnd }: { onGameEnd: (winner: TeamId) => void }) {
  const {
    state,
    actor,
    bubbles,
    muted,
    toggleMute,
    playerCanThrow,
    playerCanMove,
    selectableMoves,
    playerThrow,
    playerSelect,
  } = useGame();

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
      : `${NAME_KO[actor]}의 차례`;

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
          gap: 6,
          padding: '14px 16px 22px',
          maxWidth: 860,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* 상단: 팀 패널 + 턴 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8, flexWrap: 'wrap' }}>
          <TeamPanel team="orange" mals={state.mals} />
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
          <TeamPanel team="blue" mals={state.mals} />
        </div>

        {/* 중앙: 윷판 + 던지기 결과 */}
        <Board state={state} selectable={selectableMoves} onSelect={playerSelect} />
        <YutSticks yut={state.pendingThrow} />

        {/* 캐릭터 스탠딩 + 말풍선 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, alignItems: 'end', width: '100%' }}>
          {STANDING_ORDER.map((a) => {
            const bubble = bubbles.find((b) => b.actor === a);
            return (
              <div key={a} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minHeight: 210 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  {bubble && <SpeechBubble actor={a} text={bubble.text} />}
                </div>
                <Character
                  actor={a}
                  width={Math.min(118, 118)}
                  emotion={bubble?.emotion ?? 'neutral'}
                  talking={!!bubble}
                  active={state.phase !== 'finished' && a === actor}
                />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: ACTOR_TEAM[a] === 'blue' ? 'var(--blue)' : 'var(--orange)' }}>
                  {NAME_KO[a]}
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단: 조작 */}
        <div style={{ height: 74, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {playerCanThrow ? (
            <button className="btn-primary" onClick={playerThrow}>
              윷 던지기!
            </button>
          ) : playerCanMove ? (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--red)' }}>
              움직일 칸을 골라주세요!
            </div>
          ) : state.phase !== 'finished' ? (
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-muted)' }}>
              {NAME_KO[actor]}, 고민 중…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
