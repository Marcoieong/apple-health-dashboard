import { describe, expect, it } from 'vitest';
import { loadImportedHealthAdviceConfig } from './config.js';

describe('loadImportedHealthAdviceConfig', () => {
  it('prefers the dedicated least-privilege connection', () => {
    const config = loadImportedHealthAdviceConfig({
      IMPORTED_HEALTH_ADVICE_DATABASE_URL:
        'postgresql://advice:secret@db.example.test/app?sslmode=require',
      DATABASE_URL:
        'postgresql://owner:secret@db.example.test/app?sslmode=require'
    });

    expect(config.databaseUrl).toContain('advice:secret@db.example.test');
  });

  it('keeps the legacy database fallback for local development', () => {
    const databaseUrl =
      'postgresql://owner:secret@db.example.test/app?sslmode=require';

    expect(loadImportedHealthAdviceConfig({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl
    });
  });

  it('rejects a connection that disables TLS', () => {
    expect(() =>
      loadImportedHealthAdviceConfig({
        IMPORTED_HEALTH_ADVICE_DATABASE_URL:
          'postgresql://advice:secret@db.example.test/app?sslmode=disable'
      })
    ).toThrow('must not disable TLS');
  });
});
