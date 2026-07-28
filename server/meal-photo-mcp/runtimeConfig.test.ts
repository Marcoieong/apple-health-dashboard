import { describe, expect, it } from 'vitest';
import {
  getChatGptMcpReadiness,
  loadChatGptMcpRuntimeConfig,
  loadChatGptMcpStorageConfig
} from './runtimeConfig.js';

const completeAuth = {
  CHATGPT_MCP_RESOURCE_URL: 'https://health.pui-pui.org/mcp',
  CHATGPT_MCP_AUTHORIZATION_SERVER: 'https://login.example.com/',
  CHATGPT_MCP_ISSUER: 'https://login.example.com/',
  CHATGPT_MCP_AUDIENCE: 'https://health.pui-pui.org/api/mcp',
  CHATGPT_MCP_JWKS_URI: 'https://login.example.com/.well-known/jwks.json',
  CHATGPT_MCP_OWNER_HMAC_SECRET: 'test-secret',
  CHATGPT_MCP_ALLOWED_SUBJECT: 'auth0|owner'
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
      DATABASE_URL: 'postgres://private.example/db',
      BLOB_READ_WRITE_TOKEN: 'private-token',
      CHATGPT_MCP_INGEST_HMAC_SECRET: 'ingest-secret',
      CHATGPT_MCP_ATTACHMENT_HOSTS: 'files.openai.com, uploads.openai.com'
    };

    expect(getChatGptMcpReadiness(env).state).toBe('auth_ready');
    expect(getChatGptMcpReadiness(env, true).state).toBe('ready');
    expect(loadChatGptMcpStorageConfig(env).attachmentHosts).toEqual([
      'files.openai.com',
      'uploads.openai.com'
    ]);
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

  it('rejects non-PostgreSQL storage and malformed attachment hosts', () => {
    const storage = {
      DATABASE_URL: 'https://private.example/db',
      BLOB_READ_WRITE_TOKEN: 'private-token',
      CHATGPT_MCP_INGEST_HMAC_SECRET: 'ingest-secret',
      CHATGPT_MCP_ATTACHMENT_HOSTS: 'files.openai.com'
    };

    expect(() => loadChatGptMcpStorageConfig(storage)).toThrow(
      'must use PostgreSQL over TLS'
    );
    expect(() =>
      loadChatGptMcpStorageConfig({
        ...storage,
        DATABASE_URL: 'postgresql://private.example/db',
        CHATGPT_MCP_ATTACHMENT_HOSTS: 'https://files.openai.com/path'
      })
    ).toThrow('CHATGPT_MCP_ATTACHMENT_HOSTS is invalid');
  });

  it('accepts the legacy database variable for local deployments', () => {
    const config = loadChatGptMcpStorageConfig({
      CHATGPT_MCP_DATABASE_URL: 'postgresql://private.example/db',
      BLOB_READ_WRITE_TOKEN: 'private-token',
      CHATGPT_MCP_INGEST_HMAC_SECRET: 'ingest-secret',
      CHATGPT_MCP_ATTACHMENT_HOSTS: 'files.openai.com'
    });

    expect(config.databaseUrl).toBe('postgresql://private.example/db');
  });
});
