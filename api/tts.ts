// TTS 프록시 — 대사 텍스트 → 캐릭터 보이스 음성 (spec §3.3)
// actor → 고정 보이스 매핑은 서버 측에만 존재한다.

declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(a: ArrayBuffer): unknown };

const VOICES: Record<string, { voice: string; instructions: string }> = {
  kkaki: { voice: 'nova', instructions: '높고 경쾌한 톤. 빠르고 밝게, 새처럼 통통 튀는 느낌으로.' },
  beomtiger: { voice: 'onyx', instructions: '낮고 굵은 톤. 허세 가득한 호랑이처럼 호탕하고 크게.' },
  ninetail: { voice: 'shimmer', instructions: '중간 톤, 느긋하고 나긋한 억양. 능글맞고 여유롭게.' },
};

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
