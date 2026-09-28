export const MCP_STREAMABLE_HTTP_ACCEPT =
  'application/json, text/event-stream';

/**
 * The MCP SDK requires Streamable HTTP POST requests to accept both JSON and
 * SSE, while ChatGPT's catalogue probe can advertise JSON only. JSON response
 * mode is used by the endpoint, so widening the Accept header is safe and lets
 * the SDK process the discovery request instead of returning 406.
 */
export function normalizeMcpPostAcceptHeader(
  method: string | undefined,
  accept: string | string[] | undefined
): string | undefined {
  const combined = Array.isArray(accept) ? accept.join(',') : accept;

  if (method !== 'POST') {
    return combined;
  }

  const acceptsJson = combined?.includes('application/json') ?? false;
  const acceptsEventStream = combined?.includes('text/event-stream') ?? false;

  return acceptsJson && acceptsEventStream
    ? combined
    : MCP_STREAMABLE_HTTP_ACCEPT;
}

/**
 * Hono rebuilds its Fetch Request from Node's rawHeaders, so changing only
 * request.headers is not enough. Return a normalized raw header list while
 * preserving every unrelated header and the original header order.
 */
export function normalizeMcpPostRawHeaders(
  method: string | undefined,
  rawHeaders: readonly string[]
): string[] {
  if (method !== 'POST') {
    return [...rawHeaders];
  }

  const normalized: string[] = [];
  let acceptAdded = false;

  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = rawHeaders[index];
    const value = rawHeaders[index + 1];

    if (name?.toLowerCase() === 'accept') {
      if (!acceptAdded) {
        normalized.push(name, MCP_STREAMABLE_HTTP_ACCEPT);
        acceptAdded = true;
      }
      continue;
    }

    if (name !== undefined && value !== undefined) {
      normalized.push(name, value);
    }
  }

  if (!acceptAdded) {
    normalized.push('Accept', MCP_STREAMABLE_HTTP_ACCEPT);
  }

  return normalized;
}
