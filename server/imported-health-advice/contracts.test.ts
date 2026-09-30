import { describe, expect, it } from 'vitest';
import {
  createImportedHealthAdviceSchema,
  createShortcutImportedHealthAdviceSchema,
  deleteImportedHealthAdviceSchema
} from './contracts';

describe('imported ChatGPT Health advice contracts', () => {
  it('trims a manually imported recommendation', () => {
    expect(createImportedHealthAdviceSchema.parse({ content: '  今天早睡。  ' })).toEqual({
      content: '今天早睡。'
    });
  });

  it('rejects empty or oversized recommendations', () => {
    expect(createImportedHealthAdviceSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(createImportedHealthAdviceSchema.safeParse({ content: 'a'.repeat(4001) }).success).toBe(false);
  });

  it('requires a UUID when deleting an imported recommendation', () => {
    expect(deleteImportedHealthAdviceSchema.safeParse({ id: 'not-an-id' }).success).toBe(false);
    expect(
      deleteImportedHealthAdviceSchema.safeParse({
        id: 'd52ca744-f4bd-4b0e-94f8-5e35b7114d6a'
      }).success
    ).toBe(true);
  });

  it('accepts an idempotent Shortcut import with an offset timestamp', () => {
    expect(
      createShortcutImportedHealthAdviceSchema.parse({
        content: '  今日先補水，再步行二十分鐘。  ',
        request_id: 'sha256:1234567890abcdef',
        captured_at: '2026-08-27T08:30:00+08:00'
      })
    ).toEqual({
      content: '今日先補水，再步行二十分鐘。',
      request_id: 'sha256:1234567890abcdef',
      captured_at: '2026-08-27T08:30:00+08:00'
    });
  });

  it('rejects malformed Shortcut request identifiers and local dates', () => {
    expect(
      createShortcutImportedHealthAdviceSchema.safeParse({
        content: '今日建議',
        request_id: 'too short'
      }).success
    ).toBe(false);
    expect(
      createShortcutImportedHealthAdviceSchema.safeParse({
        content: '今日建議',
        request_id: '1234567890abcdef',
        captured_at: '2026-08-27 08:30'
      }).success
    ).toBe(false);
  });
});
