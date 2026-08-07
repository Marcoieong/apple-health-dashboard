import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
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
    } finally {
      await client.close();
      await server.close();
    }
  });
});
