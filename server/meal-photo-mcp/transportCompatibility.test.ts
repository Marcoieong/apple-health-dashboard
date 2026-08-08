import { describe, expect, it } from 'vitest';
import {
  MCP_STREAMABLE_HTTP_ACCEPT,
  normalizeMcpPostAcceptHeader,
  normalizeMcpPostRawHeaders
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

describe('normalizeMcpPostRawHeaders', () => {
  it('widens a JSON-only POST Accept header and preserves other headers', () => {
    expect(
      normalizeMcpPostRawHeaders('POST', [
        'Authorization',
        'Bearer test-token',
        'Accept',
        'application/json',
        'Content-Type',
        'application/json'
      ])
    ).toEqual([
      'Authorization',
      'Bearer test-token',
      'Accept',
      MCP_STREAMABLE_HTTP_ACCEPT,
      'Content-Type',
      'application/json'
    ]);
  });

  it('adds Accept when a POST request does not contain it', () => {
    expect(
      normalizeMcpPostRawHeaders('POST', [
        'Content-Type',
        'application/json'
      ])
    ).toEqual([
      'Content-Type',
      'application/json',
      'Accept',
      MCP_STREAMABLE_HTTP_ACCEPT
    ]);
  });

  it('handles mixed casing and removes duplicate Accept headers', () => {
    expect(
      normalizeMcpPostRawHeaders('POST', [
        'aCcEpT',
        'application/json',
        'Accept',
        '*/*'
      ])
    ).toEqual(['aCcEpT', MCP_STREAMABLE_HTTP_ACCEPT]);
  });

  it('does not alter non-POST raw headers', () => {
    const rawHeaders = ['Accept', 'application/json'];
    expect(normalizeMcpPostRawHeaders('GET', rawHeaders)).toEqual(rawHeaders);
  });
});
