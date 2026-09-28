// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  createCredentialLabel,
  loadShortcutCredentialConfig,
  openShortcutCredentialToken,
  sealShortcutCredentialToken
} from './shortcutCredentials.js';

function credentialConfig(secret = 's'.repeat(32)) {
  return loadShortcutCredentialConfig({
    DATABASE_URL: 'postgresql://user:password@example.com/database',
    SHORTCUT_TOKEN_SECRET: secret
  });
}

describe('family Shortcut credentials', () => {
  it('seals the member owner and credential ID without exposing either', async () => {
    const config = credentialConfig();
    const token = await sealShortcutCredentialToken(
      { credentialId: 'credential-a', ownerId: 'member-a' },
      config,
      new Date(Date.now() + 60_000)
    );

    expect(token).not.toContain('member-a');
    expect(token).not.toContain('credential-a');
    await expect(openShortcutCredentialToken(token, config)).resolves.toEqual({
      credentialId: 'credential-a',
      ownerId: 'member-a'
    });
  });

  it('rejects tokens encrypted for another family deployment', async () => {
    const token = await sealShortcutCredentialToken(
      { credentialId: 'credential-a', ownerId: 'member-a' },
      credentialConfig(),
      new Date(Date.now() + 60_000)
    );

    await expect(
      openShortcutCredentialToken(token, credentialConfig('x'.repeat(32)))
    ).resolves.toBeUndefined();
  });

  it('rejects expired credentials', async () => {
    const config = credentialConfig();
    const token = await sealShortcutCredentialToken(
      { credentialId: 'credential-a', ownerId: 'member-a' },
      config,
      new Date(Date.now() - 60_000)
    );

    await expect(openShortcutCredentialToken(token, config)).resolves.toBeUndefined();
  });

  it('creates a non-identifying device label', () => {
    expect(createCredentialLabel('Mobile Safari iPhone')).toMatch(
      /^iPhone [0-9A-F]{6}$/
    );
    expect(createCredentialLabel('Desktop Safari')).toMatch(
      /^此裝置 [0-9A-F]{6}$/
    );
  });
});
