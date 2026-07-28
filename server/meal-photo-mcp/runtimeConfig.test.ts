import { describe, expect, it } from 'vitest';
import {
  getChatGptMcpReadiness,
  loadChatGptMcpRuntimeConfig
} from './runtimeConfig.js';

const completeAuth = {
  CHATGPT_MCP_RESOURCE_URL: 'https://health.pui-pui.org/mcp',
  CHATGPT_MCP_AUTHORIZATION_SERVER: 'https://login.example.com/',
  CHATGPT_MCP_ISSUER: 'https://login.example.com/',
  CHATGPT_MCP_AUDIENCE: 'https://health.pui-pui.org/mcp',
  CHATGPT_MCP_JWKS_URI: 'https://login.example.com/.well-known/jwks.json',
  CHATGPT_MCP_OWNER_HMAC_SECRET: 'test-secret'
};

describe('ChatGPT MCP runtime configuration', () => {
  it('fails closed when OAuth is not configured', () => {
    expect(getChatGptMcpReadiness({})).toEqual({
      state: 'locked',
      authConfigured: false,
      privateStorageConfigured: false,
      ingestAdaptersImplemented: false,
      publicWriteEnabled: false
    });
    expect(() => loadChatGptMcpRuntimeConfig({})).toThrow(
      'OAuth configuration is incomplete'
    );
  });

  it('reports auth_ready without claiming that writes work', () => {
    expect(getChatGptMcpReadiness(completeAuth)).toEqual({
      state: 'auth_ready',
      authConfigured: true,
      privateStorageConfigured: false,
      ingestAdaptersImplemented: false,
      publicWriteEnabled: false
    });
  });

  it('requires private storage and implemented adapters before ready', () => {
    const env = {
      ...completeAuth,
      CHATGPT_MCP_DATABASE_URL: 'postgres://private.example/db',
      CHATGPT_MCP_PRIVATE_BLOB_TOKEN: 'private-token',
      CHATGPT_MCP_INGEST_HMAC_SECRET: 'ingest-secret'
    };

    expect(getChatGptMcpReadiness(env).state).toBe('auth_ready');
    expect(getChatGptMcpReadiness(env, true).state).toBe('ready');
  });

  it('rejects insecure or credential-bearing configuration URLs', () => {
    expect(() =>
      loadChatGptMcpRuntimeConfig({
        ...completeAuth,
        CHATGPT_MCP_JWKS_URI: 'http://login.example.com/jwks.json'
      })
    ).toThrow('credential-free HTTPS URL');

    expect(() =>
      loadChatGptMcpRuntimeConfig({
        ...completeAuth,
        CHATGPT_MCP_RESOURCE_URL: 'https://user:secret@health.pui-pui.org/mcp'
      })
    ).toThrow('credential-free HTTPS URL');
  });
});
