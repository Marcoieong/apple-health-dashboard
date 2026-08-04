// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { loadHealthSyncConfig } from './config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@example.com/private?sslmode=require',
  HEALTH_SYNC_TOKEN_SECRET: 't'.repeat(32),
  HEALTH_SYNC_CURSOR_SECRET: 'c'.repeat(32)
};

describe('Health sync configuration', () => {
  it('loads dedicated token and cursor secrets', () => {
    const config = loadHealthSyncConfig(validEnv);
    expect(config.databaseUrl).toContain('sslmode=require');
    expect(config.tokenKey).toHaveLength(32);
    expect(config.cursorSecret).toBe('c'.repeat(32));
  });

  it.each([
    [{ ...validEnv, DATABASE_URL: 'https://example.com' }, 'PostgreSQL'],
    [
      { ...validEnv, DATABASE_URL: 'postgresql://example.com/db?sslmode=disable' },
      'TLS'
    ],
    [{ ...validEnv, HEALTH_SYNC_TOKEN_SECRET: 'short' }, 'TOKEN_SECRET'],
    [{ ...validEnv, HEALTH_SYNC_CURSOR_SECRET: '' }, 'CURSOR_SECRET']
  ])('fails closed for invalid configuration', (env, expected) => {
    expect(() => loadHealthSyncConfig(env)).toThrow(expected);
  });
});
