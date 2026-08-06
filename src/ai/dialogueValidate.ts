// LLM 대사 출력 검증 — /api/dialogue 응답과 client 폴백 경로 양쪽에서 공유한다 (spec 없음,
// 실사용 보고: 감탄사가 어미에 융합돼 "주깍?"처럼 의미불명 대사가 나오는 현상 대응).
// 서버·클라이언트 어느 쪽이 걸러도 결과는 같다(폴백) — 두 곳 다 걸어 방어선을 이중화한다.

// 페르소나 지시("감탄사 '깍깍!'을 가끔 쓴다" 등)의 감탄사. 소형 모델이 이 토큰을 어미에
// 붙여버리는 경우가 있다 — 단어 경계 없이 나타나면 걸러낸다. 단, 한 글자짜리 융합("~주깍")까지는
// 구문 규칙으로 잡을 수 없다 — 그 근본 대응은 프롬프트 지시(COMMON) 쪽에 있다.
const CATCHPHRASES = ['깍깍', '어흥', '후후'];
const BOUNDARY = /[\s!?.…~,"'()]/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
// 기존 프리셋 대사 전수(38줄)가 예외 없이 이 넷 중 하나로 끝난다 — 데이터로 뒷받침된 규칙
const TERMINALS = new Set(['!', '.', '?', '…']);

function hasFusedCatchphrase(text: string): boolean {
  for (const phrase of CATCHPHRASES) {
    let idx = text.indexOf(phrase);
    while (idx !== -1) {
      const before = idx === 0 ? undefined : text[idx - 1];
      const after = text[idx + phrase.length];
      const okBefore = before === undefined || BOUNDARY.test(before);
      const okAfter = after === undefined || BOUNDARY.test(after);
      if (!okBefore || !okAfter) return true;
      idx = text.indexOf(phrase, idx + 1);
    }
  }
  // "깍깍"의 절반만 어미에 새어드는 사례도 있다 (실사용 보고: "…주깍?"). 정상적인 "깍깍" 쌍에
  // 속하지 않는 홑 "깍"이 하나라도 있으면 융합으로 본다 — 이 게임 어휘에 "깍"이 다른 뜻으로
  // 쓰이는 낱말(깍두기 등)은 없다.
  const validKkakPositions = new Set<number>();
  let kIdx = text.indexOf('깍깍');
  while (kIdx !== -1) {
    validKkakPositions.add(kIdx);
    validKkakPositions.add(kIdx + 1);
    kIdx = text.indexOf('깍깍', kIdx + 1);
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '깍' && !validKkakPositions.has(i)) return true;
  }
  return false;
}

/** LLM이 반환한 대사 한 줄이 게임에 내보낼 만큼 온전한지 검사한다 */
export function isWellFormedLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!TERMINALS.has(t[t.length - 1])) return false;
  if (EMOJI.test(t) || t.includes('#')) return false;
  if (hasFusedCatchphrase(t)) return false;
  return true;
}
