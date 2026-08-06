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
});
