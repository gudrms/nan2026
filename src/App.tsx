import { useCallback, useState } from 'react';
import StartScreen from './components/screens/StartScreen';
import GameScreen from './components/screens/GameScreen';
import ResultScreen from './components/screens/ResultScreen';
import type { TeamId } from './game/state';

type Screen = 'start' | 'game' | 'result';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [winner, setWinner] = useState<TeamId>('blue');
  const [gameKey, setGameKey] = useState(0); // 한 판 더 → GameScreen 리마운트

  const startGame = useCallback(() => {
    setGameKey((k) => k + 1);
    setScreen('game');
  }, []);

  const handleGameEnd = useCallback((w: TeamId) => {
    setWinner(w);
    setScreen('result');
  }, []);

  if (screen === 'start') return <StartScreen onStart={startGame} />;
  if (screen === 'game') return <GameScreen key={gameKey} onGameEnd={handleGameEnd} />;
  return <ResultScreen winner={winner} onRestart={startGame} onHome={() => setScreen('start')} />;
}
