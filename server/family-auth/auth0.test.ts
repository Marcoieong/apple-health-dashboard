// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './auth0.js';

describe('Auth0 return path validation', () => {
  const baseUrl = new URL('https://health.pui-pui.org/');

  it('keeps local paths, query strings, and fragments', () => {
    expect(safeReturnTo('/?section=food-journal', baseUrl)).toBe(
      '/?section=food-journal'
    );
    expect(safeReturnTo('/family?next=%2Ftoday#member', baseUrl)).toBe(
      '/family?next=%2Ftoday#member'
    );
  });

  it.each([
    undefined,
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/%5cevil.example',
    '/%2f%2fevil.example',
    '/safe\r\nLocation: https://evil.example'
  ])('falls back to the home path for unsafe input %s', (value) => {
    expect(safeReturnTo(value, baseUrl)).toBe('/');
  });
});
