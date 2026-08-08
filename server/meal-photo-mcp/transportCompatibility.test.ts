import { describe, expect, it } from 'vitest';
import {
  MCP_STREAMABLE_HTTP_ACCEPT,
  normalizeMcpPostAcceptHeader
} from './transportCompatibility.js';

describe('normalizeMcpPostAcceptHeader', () => {
  it.each([
    undefined,
    '*/*',
    'application/json',
    'text/event-stream'
  ])('widens a POST Accept header of %s', (accept) => {
    expect(normalizeMcpPostAcceptHeader('POST', accept)).toBe(
      MCP_STREAMABLE_HTTP_ACCEPT
    );
  });

  it('preserves a compatible POST Accept header', () => {
    const accept = 'application/json, text/event-stream';
    expect(normalizeMcpPostAcceptHeader('POST', accept)).toBe(accept);
  });

  it('preserves non-POST requests', () => {
    expect(normalizeMcpPostAcceptHeader('GET', 'application/json')).toBe(
      'application/json'
    );
  });

  it('joins a multi-value non-POST Accept header', () => {
    expect(
      normalizeMcpPostAcceptHeader('GET', [
        'application/json',
        'text/event-stream'
      ])
    ).toBe('application/json,text/event-stream');
  });
});
