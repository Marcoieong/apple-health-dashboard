import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { createMealMcpServer } from './mcpServer.js';

describe('ChatGPT MCP tool exposure', () => {
  it('exposes only the two read-only health tools when writes are disabled', async () => {
    const server = createMealMcpServer(undefined, {
      listDays: async () => [],
      listSyncStatus: async () => []
    });
    const client = new Client({ name: 'read-only-test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.listTools();

      expect(result.tools.map((tool) => tool.name).sort()).toEqual([
        'get_health_summary',
        'get_health_sync_status'
      ]);
      expect(result.tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(
        true
      );

      const rawMessages: JSONRPCMessage[] = [];
      const handleClientMessage = clientTransport.onmessage;
      clientTransport.onmessage = (message) => {
        rawMessages.push(message);
        handleClientMessage?.(message);
      };
      await client.listTools();
      const rawResult = rawMessages.find(
        (message) => 'result' in message && 'tools' in message.result
      );
      expect(rawResult).toMatchObject({
        result: {
          tools: [
            {
              name: 'get_health_summary',
              securitySchemes: [
                { type: 'oauth2', scopes: ['health.read'] }
              ],
              _meta: {
                securitySchemes: [
                  { type: 'oauth2', scopes: ['health.read'] }
                ]
              }
            },
            {
              name: 'get_health_sync_status',
              securitySchemes: [
                { type: 'oauth2', scopes: ['health.read'] }
              ],
              _meta: {
                securitySchemes: [
                  { type: 'oauth2', scopes: ['health.read'] }
                ]
              }
            }
          ]
        }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('returns an OAuth challenge when a read tool is called without authorization', async () => {
    const challenge =
      'Bearer resource_metadata="https://preview.example/.well-known/oauth-protected-resource", scope="health.read", error="insufficient_scope", error_description="health.read scope is required"';
    const server = createMealMcpServer(
      undefined,
      {
        listDays: async () => [],
        listSyncStatus: async () => []
      },
      challenge
    );
    const client = new Client({ name: 'unauthorized-test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      for (const request of [
        { name: 'get_health_summary', arguments: { days: 7 } },
        { name: 'get_health_sync_status', arguments: {} }
      ]) {
        const result = await client.callTool(request);
        expect(result).toMatchObject({
          isError: true,
          _meta: { 'mcp/www_authenticate': [challenge] }
        });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});
