import { describe, expect, it } from 'vitest';
import {
  extractHealthSyncBearerToken,
  parseHealthDateRange
} from './http.js';

describe('health sync HTTP helpers', () => {
  it('extracts only a single well-formed bearer token', () => {
    expect(extractHealthSyncBearerToken('Bearer private-token')).toBe(
      'private-token'
    );
    expect(extractHealthSyncBearerToken('Basic private-token')).toBeUndefined();
    expect(extractHealthSyncBearerToken('Bearer two tokens')).toBeUndefined();
  });

  it('defaults to an inclusive 30-day UTC range', () => {
    expect(parseHealthDateRange({}, new Date('2026-08-05T01:00:00Z'))).toEqual({
      from: '2026-07-07',
      to: '2026-08-05'
    });
  });

  it('accepts a valid explicit range', () => {
    expect(parseHealthDateRange({ from: '2026-08-01', to: '2026-08-05' })).toEqual(
      { from: '2026-08-01', to: '2026-08-05' }
    );
  });

  it('rejects invalid, reversed, or oversized ranges', () => {
    expect(() => parseHealthDateRange({ from: '2026-02-30' })).toThrow(
      'invalid_date_range'
    );
    expect(() =>
      parseHealthDateRange({ from: '2026-08-05', to: '2026-08-01' })
    ).toThrow('invalid_date_range');
    expect(() =>
      parseHealthDateRange({ from: '2025-01-01', to: '2026-08-01' })
    ).toThrow('invalid_date_range');
  });
});
