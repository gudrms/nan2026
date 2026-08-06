import { describe, expect, it } from 'vitest';
import { isWellFormedLine } from '../src/ai/dialogueValidate';

describe('isWellFormedLine', () => {
  it('정상적인 대사는 통과한다', () => {
    expect(isWellFormedLine('깍깍! 대박이에요!')).toBe(true);
    expect(isWellFormedLine('어흥! 이 몸이 간다!')).toBe(true);
    expect(isWellFormedLine('어머, 후후. 계산대로예요.')).toBe(true);
    expect(isWellFormedLine('그렇군요…')).toBe(true);
  });

  it('빈 문자열·공백만 있는 경우 거부한다', () => {
    expect(isWellFormedLine('')).toBe(false);
    expect(isWellFormedLine('   ')).toBe(false);
  });

  it('문장부호로 끝나지 않으면 거부한다 (기존 프리셋 38줄 전수가 !/./?/… 로 끝남)', () => {
    expect(isWellFormedLine('대박이에요')).toBe(false);
    expect(isWellFormedLine('그런거였다구요')).toBe(false);
  });

  it('이모지·해시태그가 섞이면 거부한다 (프롬프트 지시 위반 감지)', () => {
    expect(isWellFormedLine('대박이에요! 🎉')).toBe(false);
    expect(isWellFormedLine('완승! #대장최고')).toBe(false);
  });

  it('감탄사가 단어 경계 없이 어미에 융합되면 거부한다 — 실사용 보고 사례("주깍?")', () => {
    expect(isWellFormedLine('그런거였구깍?')).toBe(false);
    expect(isWellFormedLine('진짜주깍깍!')).toBe(false);
    expect(isWellFormedLine('큰일이어흥!')).toBe(false);
  });

  it('감탄사가 독립된 토큰이면 통과한다 (문장 처음·끝, 구두점 경계)', () => {
    expect(isWellFormedLine('깍깍, 대박이에요!')).toBe(true);
    expect(isWellFormedLine('대박이에요, 깍깍!')).toBe(true);
    expect(isWellFormedLine('어흥! 이 몸이다!')).toBe(true);
  });
});
