// Vercel Serverless Function 라우팅 확인용 더미. M3에서 dialogue/tts로 대체된다.
export default function handler(_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) {
  res.status(200).json({ ok: true });
}
