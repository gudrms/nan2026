# 기술 명세 (Tech Spec) — 윷놀이 : 까치호랑이

- **작성일**: 2026-07-24
- **연관 문서**: [CONCEPT.md](./CONCEPT.md) (게임 컨셉) · [ADR.md](./ADR.md) (결정 기록) · [Requirements.md](./Requirements.md) (과제 요구사항)

---

## 1. 스택 한눈에 보기

| 레이어 | 선택 | 버전 기준 |
|---|---|---|
| 언어 | **TypeScript** (전 영역 단일 언어) | 5.x |
| 프론트엔드 | **React** + **Vite** | React 18+, Vite 5+ |
| 게임판 렌더링 | **SVG + CSS 애니메이션** (윷판·말·이동, 노드 클릭에 유리 — 보류 결정 D-8로 Canvas에서 전환) | 브라우저 내장 |
| 캐릭터/UI 비주얼 | **SVG/CSS 도형 + 팀 제작 캐릭터 이미지** (ADR-003, 타인 저작물 에셋 0개) | — |
| 게임 로직 | 순수 TS 모듈 (프레임워크 무의존) | — |
| 서버 | **Vercel Serverless Functions** (프록시 2개) | Node 20 런타임 |
| 외부 AI API | OpenAI — Chat Completions(대사 생성) + TTS(음성) | — |
| 배포 | **Vercel** (정적 사이트 + Functions 단일 배포) | — |
| 저장소 | GitHub Public | — |
| 테스트 | **Vitest** (게임 룰 유닛 테스트) | — |
| 패키지 매니저 | npm | — |

### 명시적으로 쓰지 않는 것 (ADR 근거)

| 미채택 | 이유 |
|---|---|
| Unity / 게임엔진 | 웹 제출 요건에 과잉, AI 페어코딩·커밋 기록 축적에 불리 (ADR-001 D2) |
| Next.js | SSR·라우팅 불필요. 페이지 1개 + API 2개에 프레임워크 오버헤드 (ADR-002 예정) |
| 상태관리 라이브러리 (Redux 등) | 게임 상태는 순수 TS 게임 모듈이 소유, React는 구독만. useState/useReducer로 충분 |
| DB / 인증 / 세션 | 저장할 서버 상태 없음. 완전 클라이언트 게임 + 무상태 프록시 |
| 외부 이미지·오디오 에셋 | 라이선스 리스크 원천 차단. 전량 SVG/CSS/Web Audio 코드 생성 (효과음만 CC0 검토) |

## 2. 프로젝트 구조

```
nhn/
├─ docs/                    # 기획·결정 문서 (본 문서 포함)
├─ api/                     # Vercel Serverless Functions
│  ├─ dialogue.ts           #   POST 게임 상황 → LLM 대사 생성
│  └─ tts.ts                #   POST 대사 텍스트 → 음성(mp3) 반환
├─ src/
│  ├─ game/                 # ★ 순수 TS 게임 코어 (React/DOM 무의존)
│  │  ├─ board.ts           #   윷판 29노드 그래프, 경로/지름길 정의
│  │  ├─ rules.ts           #   이동·잡기·업기·완주·추가턴 룰
│  │  ├─ throwYut.ts        #   윷 던지기 확률 모델 (도~모)
│  │  ├─ state.ts           #   GameState 타입, 상태 전이 (reducer 패턴)
│  │  ├─ botAI.ts           #   판단 AI: 기대값 탐색 말 선택 (아군1·적2 공용)
│  │  ├─ simulate.ts        #   자동 대전 시뮬레이션 하네스 (봇 vs 봇 N판 통계)
│  │  └─ events.ts          #   대사 트리거 이벤트 판정 (잡기/업기/역전 등)
│  ├─ ai/                   # 성격 AI 클라이언트 레이어
│  │  ├─ dialogueClient.ts  #   /api/dialogue 호출 + 프리셋 폴백
│  │  ├─ ttsClient.ts       #   /api/tts 호출 + 재생 큐 (음소거 토글)
│  │  ├─ presetLines.ts     #   프리셋 대사 풀 (LLM 실패 시 폴백). 페르소나 원본은
│  │  │                     #   `api/dialogue.ts` 서버 상수(클라이언트 조작 불가, CONCEPT §4 기준)
│  │  └─ situation.ts       #   게임 상태 → 프롬프트용 판세 요약 문장
│  ├─ components/           # React UI
│  │  ├─ screens/           #   Start / Game / Result 3화면
│  │  ├─ Board.tsx          #   SVG 윷판 렌더링(윷판+말+애니메이션) — 보류 결정 D-8
│  │  ├─ Character.tsx      #   캐릭터 4인 (idle/talk 이미지 + emotion 오버레이, ADR-003)
│  │  ├─ SpeechBubble.tsx   #   말풍선
│  │  └─ YutSticks.tsx      #   윷 던지기 결과 연출
│  ├─ hooks/                #   useGame (게임 코어 ↔ React 연결점)
│  ├─ assets/characters/    #   팀 제작 캐릭터 이미지 (ADR-003)
│  └─ audio/                #   Web Audio 합성 효과음·BGM (외부 음원 0개)
├─ tests/                   # Vitest — game/ + ai/ 폴백 로직 대상
├─ index.html
├─ vite.config.ts
└─ vercel.json              # 정적 빌드 + api/ 함수 라우팅
```

**구조 원칙**: `src/game/`은 import 방향이 바깥→안 단방향 (game은 아무것도 모른다). 심사자가 소스를 열었을 때 "게임 로직이 어디 있는가"가 즉시 보이는 구조를 유지한다.

## 3. 데이터 흐름

### 3.1 게임 루프 (동기, 로컬)

```
사용자 클릭 → throwYut() → rules.getMovableMals() → (플레이어: 클릭 선택 | 봇: botAI.choose())
→ state 전이 → events.detect() 로 대사 이벤트 판정 → Board 리렌더
```

게임 진행은 **네트워크와 완전 무관**하게 동작한다. AI 대사는 곁가지(fire-and-forget)다.

### 3.2 대사 파이프라인 (비동기, 논블로킹)

```
events.detect() ⇒ DialogueEvent { type, actor, 판세요약 }
  → dialogueClient: POST /api/dialogue ─(프록시)→ OpenAI Chat → 대사 텍스트
  → ttsClient:     POST /api/tts      ─(프록시)→ OpenAI TTS → mp3 blob
  → SpeechBubble 표시 + 오디오 재생 + 캐릭터 입 애니메이션 (동시)

실패/타임아웃(3s) 시 → presetLines.ts 의 프리셋 대사 풀에서 즉시 선택 (음성 없이 말풍선만)
```

### 3.3 API 계약

**POST `/api/dialogue`**
```jsonc
// 요청
{
  "actor": "kkaki" | "beomtiger" | "ninetail",
  "event": "CAPTURE" | "CAPTURED" | "STACK" | "YUT_MO" | "FINISH" | "LEAD_CHANGE" | "GAME_START" | "GAME_END" | "HINT",
  "situation": "범이가 도령의 말을 12번 칸에서 잡음. 현재 점수 …", // 판세 요약 문자열
  "history": [                                    // 최근 대사 3~5개 (대화 메모리)
    { "actor": "beomtiger", "text": "어흥! 이 몸을 누가 막느냐!" }
  ]
}
// 응답 — Structured Output (JSON 스키마 강제)
{ "text": "아까 큰소리치더니 잡히셨네요, 범이 씨?", "emotion": "joy" }
// emotion: "neutral" | "joy" | "anger" | "surprise" → SVG 캐릭터 표정과 연동
```

- **대화 메모리**: 직전 대사들을 컨텍스트로 전달 → 봇끼리 서로 받아치는 연속 대화(티키타카) 생성
- **Structured Output**: 응답을 JSON 스키마로 강제(`response_format`) → emotion 값이 캐릭터 표정 상태를 구동, 파싱 실패 없음

**POST `/api/tts`**
```jsonc
// 요청
{ "actor": "kkaki", "text": "대장, 지금 업는 게 이득이에요!" }
// 응답: audio/mpeg 바이너리 (actor → 고정 보이스 매핑은 서버 측)
```

- 페르소나 시스템 프롬프트는 **서버(`api/dialogue.ts`)에 상수로 보관** — 클라이언트에서 프롬프트 조작 불가
- 프록시 공통: 요청 크기 제한, 간단한 레이트 리밋(IP 기준), CORS 자체 도메인 한정

## 4. 핵심 설계 결정 상세

### 4.1 게임 상태 — reducer 패턴 순수 함수

```ts
// state.ts 요지
type GameState = { phase, teams, mals: MalPosition[], currentTurn, throwResult, winner? }
function reduce(state: GameState, action: GameAction): GameState  // 순수 함수
```
- 순수 함수라 Vitest로 룰 전체를 스냅샷 없이 테스트 가능 (잡기/업기/지름길 엣지케이스)
- React 쪽은 `useGame` 훅에서 이 reducer를 구독할 뿐

### 4.2 판단 AI (botAI.ts) — 기대값 탐색 (Expectimax)

윷놀이는 확률 게임이므로 판단 AI는 단순 if-else가 아닌 **기대값 기반 탐색**으로 구현한다:

```
각 후보 수(말 × 이동)에 대해:
  즉시 이득 평가 (잡기 성공, 업기, 전진 거리, 지름길 진입)
  + 상대 다음 던지기의 확률분포 (도 15.4% / 개 34.6% / 걸 34.6% / 윷 13% / 모 2.6%) 를 펼쳐
    "이 수를 두면 다음 턴에 잡힐 기대 손실" 계산
  → 기대값 최대 수 선택 (탐색 깊이 1~2수)
```

- **캐릭터별 가중치**로 성격을 플레이 스타일에 반영: 범이(잡기 가치 ↑, 위험 감수), 여울(피격 회피 ↑, 안전 주행), 까비(균형)
- 개발 순서: M1에서 단순 휴리스틱(잡기>회피>업기>전진) 버전 먼저 → 기대값 탐색 버전으로 교체, **두 버전을 자동 대전시켜 승률로 개선을 정량 검증** (§4.5)
- LLM은 판단에 관여하지 않음 (지연·실패가 게임을 멈추지 못하게) — ADR-001 D4

### 4.3 윷 확률 모델

- 윷가락 1개당 평면(앞) 확률 0.6으로 4개 독립 시행 → 도/개/걸/윷/모의 이항분포가 자연 도출 (균등 1/5는 윷·모 40%로 밸런스 붕괴 — 기각), 빽도 제외(MVP)
- `throwYut(rng)` 형태로 난수 주입 → 테스트 시 고정 시드 가능
- 가락 4개의 앞/뒤 상태를 그대로 반환 → 던지기 애니메이션 연출에 재사용
- p=0.6은 초기값. 시뮬레이션 하네스(§4.5)로 게임 템포 확인 후 조정

### 4.5 자동 대전 시뮬레이션 하네스 (simulate.ts)

게임 코어가 순수 TS이므로 헤드리스로 봇 4인 자동 대전이 가능하다. 이를 밸런싱·AI 검증 도구로 활용:

```
npm run simulate -- --games 1000
→ 팀별 승률, 평균 턴 수, 평균 잡기 횟수, 던지기 분포 통계 출력
```

- **용도 1 — AI 검증**: 휴리스틱 봇 vs 기대값 탐색 봇 대전 승률로 알고리즘 개선을 정량 입증
- **용도 2 — 밸런싱**: p값·말 개수·지름길 유무에 따른 평균 게임 길이 측정 → 데모 템포(5~10분) 튜닝
- 결과 통계는 AI 활용 기술 문서의 근거 데이터로 수록

### 4.4 TTS 재생 큐

- 대사가 겹칠 때(잡기: 두 캐릭터 연속 반응) 순차 재생 큐로 관리
- 큐 대기 2개 초과 시 오래된 것 드롭 (템포 우선)
- 첫 사용자 클릭 후 AudioContext 활성화 (브라우저 자동재생 정책 대응)

## 5. 환경 변수 / 배포

| 변수 | 위치 | 용도 |
|---|---|---|
| `OPENAI_API_KEY` | Vercel 환경변수 (서버 전용) | 프록시에서만 사용, 클라이언트 노출 금지 |

- 배포: GitHub main 푸시 → Vercel 자동 배포 (정적 + Functions)
- 저장소: GitHub Public, 커밋 단위 = 기능 단위 (과제 "커밋 기록 유지" 요건)
- 로컬 개발: `vercel dev` (Functions 포함 로컬 실행) 또는 Vite dev + 프리셋 폴백 모드

## 6. 테스트 전략

| 대상 | 방법 |
|---|---|
| `src/game/` 룰 전체 | Vitest 유닛 테스트 — 잡기/업기/지름길 진입/추가턴/완주 판정, 고정 시드 윷 던지기 |
| 판단 AI | 시나리오 기반: "잡을 수 있으면 잡는다" 등 우선순위 검증 |
| 프록시 | 로컬 호출 스모크 테스트 + 폴백 경로(키 없음/타임아웃) 확인 |
| UI/연출 | 수동 확인 (데모 영상 시나리오 CONCEPT §10 기준으로 점검) |

## 7. 성능·호환 목표

- 초기 로드: 외부 에셋이 없으므로 JS 번들 중심 — 목표 < 300KB gzip
- 모바일 브라우저(iOS Safari, Android Chrome) 동작 확인 — 반응형 레이아웃, 터치 조작
- LLM/TTS 왕복은 게임 템포와 무관하도록 전부 비동기 + 3초 타임아웃 폴백

## 8. AI 활용 개발 프로세스 (과제 핵심축)

> 과제의 본질은 "게임 안에 AI가 있는가"가 아니라 **"AI로 게임을 어떻게 만들었는가"**다 (Requirements 항목 4).
> 인게임 LLM은 가산 요소이고, 평가의 중심은 개발 과정 전체의 AI 활용이다. 따라서 과정을 **개발하면서 실시간으로 기록**한다 — 마감 직전에 기억으로 재구성하지 않는다.

### 8.1 단계별 AI 활용 지도

| 개발 단계 | AI 활용 방식 | 산출 증거 |
|---|---|---|
| 과제 분석 | 과제 요구사항의 의도 분석, 기존 Unity 프로젝트 리스크 진단 | ADR-001, 대화 로그 |
| 기획 | 컨셉 후보 비교(주사위 레이스 vs 윷놀이), 캐릭터·세계관 설계 | CONCEPT.md |
| 설계 | 스택 토론(Unity/웹, Node/Python, Next 여부), 확률 모델 검증(균등 1/5 기각 → 이항분포) | ADR.md, spec.md |
| 디자인 | 화면 시안·SVG 캐릭터를 AI로 생성 → 코드로 직결 | 시안 커밋 |
| 구현 | AI 페어코딩 (본 문서 기준), 커밋 단위 기록 | Git 히스토리 |
| 검증 | 룰 테스트 생성, 시뮬레이션 하네스 통계 분석 | tests/, 시뮬레이션 리포트 |
| 인게임 AI | LLM 페르소나 프롬프트 설계·튜닝 과정 | api/dialogue.ts, AI_USAGE.md |

### 8.2 기록 체계

- **`docs/AI_USAGE.md`**: AI 활용 로그 (제출물 4의 원고). 주요 의사결정·프롬프트·AI 제안 채택/기각 사례를 세션마다 추가
- **커밋 컨벤션**: 기능 단위 커밋 + 본문에 AI 활용 맥락 표기 (예: `feat: 기대값 탐색 봇 구현` / 본문: 휴리스틱 대비 승률 +N%p, 시뮬레이션 1000판 검증)
- **채택/기각 기록이 핵심**: "AI가 시킨 대로 다 했다"보다 "AI 제안을 검증하고 기각한 사례"(예: 균등 확률 기각)가 활용 역량의 증거

## 9. 구현 순서 (마일스톤)

| # | 마일스톤 | 완료 기준 (verify) |
|---|---|---|
| M1 | 게임 코어 (`src/game/`) + 테스트 + 시뮬레이션 하네스 | Vitest 전부 통과, 봇 4인 1000판 자동 대전 통계 출력, 기대값 봇 > 휴리스틱 봇 승률 확인 |
| M2 | 디자인 시안 → React 화면 3종 + SVG 윷판 | 브라우저에서 플레이어 1인 + 봇 3인 한 판 완주 가능 |
| M3 | 프록시 + LLM 대사 + TTS + 폴백 | 잡기 이벤트에서 캐릭터가 실시간 대사를 말함 / 키 제거 시 폴백 동작 |
| M4 | 연출 다듬기 (애니메이션·효과음·모바일) | CONCEPT §10 데모 시나리오가 실제로 촬영 가능 |
| M5 | 배포 + 제출물 (영상·PDF 3종) | Vercel URL 접속 즉시 플레이 가능, 문서 완비 |
