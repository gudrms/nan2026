// TTS 프록시 — 대사 텍스트 → 캐릭터 보이스 음성 (spec §3.3)
// actor → 고정 보이스 매핑은 서버 측에만 존재한다.

declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(a: ArrayBuffer): unknown };

// @vercel/node 의존성 없이 실제 런타임 형태만 최소로 선언 (req.body는 검증 전 원시 JSON이라 any 유지)
interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}
interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void; send(body: unknown): void };
}

const VOICES: Record<string, { voice: string; instructions: string }> = {
  kkaki: { voice: 'nova', instructions: '높고 경쾌한 톤. 빠르고 밝게, 새처럼 통통 튀는 느낌으로.' },
  beomtiger: { voice: 'onyx', instructions: '낮고 굵은 톤. 허세 가득한 호랑이처럼 호탕하고 크게.' },
  ninetail: { voice: 'shimmer', instructions: '중간 톤, 느긋하고 나긋한 억양. 능글맞고 여유롭게.' },
};

const RATE = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  // 매 호출마다 전체 맵을 정리 — 유휴 IP 키가 인스턴스 수명 동안 무한정 쌓이지 않게
  for (const [key, hits] of RATE) {
    const kept = hits.filter((t) => now - t < 60_000);
    if (kept.length === 0) RATE.delete(key);
    else RATE.set(key, kept);
  }
  const hits = RATE.get(ip) ?? [];
  if (hits.length >= 30) return true;
  hits.push(now);
  RATE.set(ip, hits);
  return false;
}

// 인스턴스 전역 상한 — 분산 IP로 IP별 리밋을 우회해도 인스턴스당 비용이 유계
let globalHits: number[] = [];
function globalLimited(): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < 60_000);
  if (globalHits.length >= 120) return true;
  globalHits.push(now);
  return false;
}

// 게임 페이지에서 온 요청만 허용 — 외부 스크립트의 프록시 남용 차단.
// 브라우저는 POST에 항상 Origin을 실어 보내므로, 없거나 호스트 불일치면 거부.
function badOrigin(req: VercelRequest): boolean {
  try {
    return new URL(String(req.headers.origin ?? '')).host !== String(req.headers.host ?? '');
  } catch {
    return true;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (badOrigin(req)) return res.status(403).json({ error: 'forbidden' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no api key' });

  const ip = String(req.headers['x-forwarded-for'] ?? 'local').split(',')[0].trim();
  if (rateLimited(ip) || globalLimited()) return res.status(429).json({ error: 'rate limited' });

  const { actor, text } = req.body ?? {};
  const voice = VOICES[actor];
  if (!voice) return res.status(400).json({ error: 'unknown actor' });
  if (typeof text !== 'string' || !text || text.length > 120) return res.status(400).json({ error: 'bad text' });

  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: voice.voice,
        instructions: voice.instructions,
        input: text,
        response_format: 'mp3',
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `openai ${r.status}` });
    const audio = await r.arrayBuffer();
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    return res.status(200).send(Buffer.from(audio));
  } catch {
    return res.status(502).json({ error: 'upstream failure' });
  }
}
