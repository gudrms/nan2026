import type { GameEvent } from '../game/events';
import { teamProgress } from '../game/events';
import type { GameState } from '../game/state';
import type { YutName } from '../game/throwYut';

// LLM 프롬프트에 넣을 판세 요약 문자열 생성 (spec §6.2 — 상황에 맞는 대사의 근거)

const YUT_KO: Record<YutName, string> = { do: '도', gae: '개', geol: '걸', yut: '윷', mo: '모' };
const ACTOR_KO: Record<string, string> = {
  player: '플레이어',
  kkaki: '깍이',
  beomtiger: '범발톱',
  ninetail: '꼬리아홉',
};

export function describeSituation(ev: GameEvent, state: GameState): string {
  const blue = teamProgress(state, 'blue');
  const orange = teamProgress(state, 'orange');
  const standing = `판세 — 플레이어팀 진행도 ${blue}, 호랑이팀 진행도 ${orange} (완주는 팀당 말 전부 도착).`;
  const who = ACTOR_KO[ev.actor] ?? ev.actor;
  const side = ev.team === 'blue' ? '플레이어팀' : '호랑이팀';

  switch (ev.type) {
    case 'GAME_START':
      return `설날 마당, 윷놀이 한판이 막 시작됐다. 시작 인사를 나눈다.`;
    case 'YUT_MO':
      return `${who}(${side})가 ${YUT_KO[ev.detail?.yutName ?? 'yut']}를 던져 한 번 더 던질 기회를 얻었다. ${standing}`;
    case 'CAPTURE':
      return `${who}(${side})가 상대 말 ${ev.detail?.capturedCount ?? 1}개를 잡아 출발점으로 돌려보냈다! 잡은 팀은 한 번 더 던진다. ${standing}`;
    case 'STACK':
      return `${who}(${side})가 자기 말을 업어서 함께 이동하게 됐다. ${standing}`;
    case 'FINISH':
      return `${who}(${side})의 말이 완주했다. ${standing}`;
    case 'LEAD_CHANGE':
      return `선두가 뒤집혔다! 이제 ${ev.detail?.newLeader === 'blue' ? '플레이어팀' : '호랑이팀'}이 앞선다. ${standing}`;
    case 'GAME_END':
      return `게임 종료 — ${ev.detail?.winner === 'blue' ? '플레이어팀' : '호랑이팀'}의 승리다. 마무리 소감을 말한다. ${standing}`;
  }
}
