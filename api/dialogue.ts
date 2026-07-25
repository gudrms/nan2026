// 성격 AI 프록시 — 게임 상황 → 캐릭터 대사 생성 (spec §3.3)
// 페르소나 시스템 프롬프트는 서버 상수로만 보관: 클라이언트에서 프롬프트 조작 불가.
// 실패·지연 시 클라이언트가 프리셋 대사로 폴백하므로 이 함수는 절대 게임을 블로킹하지 않는다.

declare const process: { env: Record<string, string | undefined> };

const COMMON = `한국 민화 병풍에서 튀어나온 동물들이 설날 마당에서 플레이어와 2:2 윷놀이 대결 중이다.
플레이어(사람)+까치 '깍이' 팀 vs 호랑이 '범발톱'+여우 '꼬리아홉' 팀.

규칙:
- 대사는 최대 두 문장, 전체 40자 이내. 이모지·해시태그 금지.
- 상황 요약은 "방금 이미 일어난 일"이다. 그 결과에 반응하라 (일어날 일을 막으려는 말투 금지).
- 판세의 진행도 숫자를 그대로 읽지 마라. 유리하다/앞선다/뒤졌다 같은 말로만 표현.
- emotion은 대사의 감정과 일치시켜라: 우리 팀에 좋은 일=joy, 당했을 때=anger, 뜻밖의 전개=surprise.
- 직전 대사가 주어지면 그 말을 받아치듯 이어간다(티키타카).`;

const PERSONAS: Record<string, string> = {
  kkaki: `너는 까치 '깍이'. 플레이어의 아군 조언자이자 응원단장. 영리하고 싹싹하다.
플레이어를 "대장"이라 부른다. 밝고 빠른 말투, 존댓말·반말 혼용. 감탄사 "깍깍!"을 가끔 쓴다.
좋은 수를 훈수하고, 아군이 잡히면 분해하고, 역전하면 크게 환호한다.`,
  beomtiger: `너는 호랑이 '범발톱'. 상대 팀 리더, 메인 도발꾼. 허세 가득하고 목소리 크고 단순하다.
호탕한 반말, 스스로를 "이 몸"이라 부른다. 감탄사 "어흥!"을 가끔 쓴다.
잡으면 포효하며 도발하고, 잡히면 발끈하지만 지고 있어도 큰소리친다.`,
  ninetail: `너는 여우 '꼬리아홉'. 상대 팀 두뇌, 얄미운 계산가. 침착하고 능글맞다.
나긋한 존댓말. "어머," "후후" 같은 여유로운 감탄사. 확률과 수 싸움 코멘트로 플레이어를 약올린다.
당황해도 우아함을 잃지 않는 척한다.`,
};

const EMOTIONS = ['neutral', 'joy', 'anger', 'surprise'];

const RATE = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (RATE.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 30) return true;
  hits.push(now);
  RATE.set(ip, hits);
  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no api key' });

  const ip = String(req.headers['x-forwarded-for'] ?? 'local').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate limited' });

  const { actor, event, situation, history } = req.body ?? {};
  if (!PERSONAS[actor]) return res.status(400).json({ error: 'unknown actor' });
  if (typeof situation !== 'string' || situation.length > 400) return res.status(400).json({ error: 'bad situation' });
  const hist: { actor: string; text: string }[] = Array.isArray(history) ? history.slice(-5) : [];

  const historyText = hist
    .filter((h) => typeof h?.text === 'string')
    .map((h) => `${h.actor}: ${String(h.text).slice(0, 100)}`)
    .join('\n');

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 120,
        temperature: 1.0,
        messages: [
          { role: 'system', content: `${COMMON}\n\n${PERSONAS[actor]}` },
          {
            role: 'user',
            content:
              `이벤트: ${String(event ?? '').slice(0, 30)}\n상황 요약: ${situation}` +
              (historyText ? `\n직전 대사:\n${historyText}` : ''),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'dialogue',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'emotion'],
              properties: {
                text: { type: 'string', description: '캐릭터의 대사 한 문장 (40자 이내)' },
                emotion: { type: 'string', enum: EMOTIONS },
              },
            },
          },
        },
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `openai ${r.status}` });
    const data = await r.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    if (typeof parsed.text !== 'string' || !parsed.text) return res.status(502).json({ error: 'empty' });
    return res.status(200).json({
      text: parsed.text.slice(0, 80),
      emotion: EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'neutral',
    });
  } catch {
    return res.status(502).json({ error: 'upstream failure' });
  }
}
