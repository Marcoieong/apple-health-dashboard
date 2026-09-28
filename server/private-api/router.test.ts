// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePrivateApi } from './router.js';

function responseDouble() {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn()
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('private API router', () => {
  it('rejects unknown private paths without invoking a data handler', async () => {
    const response = responseDouble();
    await handlePrivateApi(
      { method: 'GET', query: { path: ['unknown'] } } as unknown as VercelRequest,
      response as unknown as VercelResponse
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: 'not_found' });
  });

  it('dispatches nested health routes and preserves their method policy', async () => {
    const response = responseDouble();
    await handlePrivateApi(
      {
        method: 'POST',
        query: { path: ['health', 'sync-status'] }
      } as unknown as VercelRequest,
      response as unknown as VercelResponse
    );

    expect(response.setHeader).toHaveBeenCalledWith('Allow', 'GET');
    expect(response.status).toHaveBeenCalledWith(405);
    expect(response.json).toHaveBeenCalledWith({ error: 'method_not_allowed' });
  });

  it('falls back to the request URL when Vercel omits the catch-all query', async () => {
    const response = responseDouble();
    await handlePrivateApi(
      {
        method: 'PUT',
        query: {},
        url: '/api/private/health-devices'
      } as unknown as VercelRequest,
      response as unknown as VercelResponse
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'Allow',
      'GET, POST, DELETE'
    );
    expect(response.status).toHaveBeenCalledWith(405);
    expect(response.json).toHaveBeenCalledWith({ error: 'method_not_allowed' });
  });

  it('parses nested private paths from the request URL fallback', async () => {
    const response = responseDouble();
    await handlePrivateApi(
      {
        method: 'POST',
        query: {},
        url: '/api/private/health/sync-status?source=dashboard'
      } as unknown as VercelRequest,
      response as unknown as VercelResponse
    );

    expect(response.setHeader).toHaveBeenCalledWith('Allow', 'GET');
    expect(response.status).toHaveBeenCalledWith(405);
  });
});
