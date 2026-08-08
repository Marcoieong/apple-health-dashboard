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
