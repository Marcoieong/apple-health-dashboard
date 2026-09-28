import { describe, expect, it } from 'vitest';
import {
  extractShortcutBearerToken,
  isValidShortcutToken,
  loadShortcutRuntimeConfig
} from './shortcutAuth.js';

describe('Shortcut authentication', () => {
  it('loads only complete, suitably long private credentials', () => {
    expect(
      loadShortcutRuntimeConfig({
        SHORTCUT_ACCESS_TOKEN: 'a'.repeat(64),
        SHORTCUT_OWNER_ID: 'private-owner'
      })
    ).toEqual({
      accessToken: 'a'.repeat(64),
      ownerId: 'private-owner'
    });

    expect(() =>
      loadShortcutRuntimeConfig({
        SHORTCUT_ACCESS_TOKEN: 'too-short',
        SHORTCUT_OWNER_ID: 'private-owner'
      })
    ).toThrow('incomplete');
  });

  it('accepts a single Bearer token and rejects malformed headers', () => {
    expect(extractShortcutBearerToken('Bearer private-token')).toBe(
      'private-token'
    );
    expect(extractShortcutBearerToken('Basic private-token')).toBeUndefined();
    expect(
      extractShortcutBearerToken('Bearer private token')
    ).toBeUndefined();
  });

  it('compares the supplied token without exposing the expected value', () => {
    const expected = 'f'.repeat(64);
    expect(isValidShortcutToken(expected, expected)).toBe(true);
    expect(isValidShortcutToken('e'.repeat(64), expected)).toBe(false);
    expect(isValidShortcutToken(undefined, expected)).toBe(false);
  });
});
