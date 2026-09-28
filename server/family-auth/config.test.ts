import { describe, expect, it } from 'vitest';
import {
  deriveFamilyOwnerId,
  isAllowedFamilyEmail,
  loadFamilyAuthConfig
} from './config.js';

function familyEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    AUTH0_WEB_ISSUER: 'https://family-test.auth0.com',
    AUTH0_WEB_CLIENT_ID: 'family-client',
    AUTH0_WEB_CLIENT_SECRET: 'c'.repeat(32),
    AUTH0_WEB_BASE_URL: 'https://preview.example.com/path?ignored=1',
    AUTH0_WEB_ALLOWED_EMAILS: ' Marco@pui-pui.org , family@example.com ',
    AUTH0_WEB_ADMIN_EMAIL: 'MARCO@PUI-PUI.ORG',
    WEB_SESSION_SECRET: 's'.repeat(32),
    AUTH0_WEB_OWNER_HMAC_SECRET: 'o'.repeat(32),
    ...overrides
  };
}

describe('family auth configuration', () => {
  it('normalizes invited emails and the public base origin', () => {
    const config = loadFamilyAuthConfig(familyEnv());

    expect(config.baseUrl.href).toBe('https://preview.example.com/');
    expect(config.adminEmail).toBe('marco@pui-pui.org');
    expect(isAllowedFamilyEmail(config, ' FAMILY@example.com ')).toBe(true);
    expect(isAllowedFamilyEmail(config, 'outsider@example.com')).toBe(false);
  });

  it('rejects an admin who is not explicitly invited', () => {
    expect(() =>
      loadFamilyAuthConfig(
        familyEnv({ AUTH0_WEB_ADMIN_EMAIL: 'outsider@example.com' })
      )
    ).toThrow('must be in AUTH0_WEB_ALLOWED_EMAILS');
  });

  it('requires legacy owner migration values as a complete pair', () => {
    expect(() =>
      loadFamilyAuthConfig(
        familyEnv({ AUTH0_WEB_LEGACY_OWNER_EMAIL: 'marco@pui-pui.org' })
      )
    ).toThrow('configured together');
  });

  it('keeps Marco on the existing owner while isolating other members', () => {
    const config = loadFamilyAuthConfig(
      familyEnv({
        AUTH0_WEB_LEGACY_OWNER_EMAIL: 'marco@pui-pui.org',
        AUTH0_WEB_LEGACY_OWNER_ID: 'existing-marco-owner'
      })
    );

    expect(
      deriveFamilyOwnerId(config, 'auth0|marco', 'MARCO@PUI-PUI.ORG')
    ).toBe('existing-marco-owner');
    const familyOwner = deriveFamilyOwnerId(
      config,
      'auth0|family-member',
      'family@example.com'
    );
    expect(familyOwner).toMatch(/^family_[A-Za-z0-9_-]{43}$/);
    expect(familyOwner).not.toBe('existing-marco-owner');
  });

  it('keeps a member owner stable when their verified email changes', () => {
    const config = loadFamilyAuthConfig(familyEnv());

    expect(
      deriveFamilyOwnerId(config, 'auth0|stable-subject', 'old@example.com')
    ).toBe(
      deriveFamilyOwnerId(config, 'auth0|stable-subject', 'new@example.com')
    );
    expect(
      deriveFamilyOwnerId(config, 'auth0|another-subject', 'new@example.com')
    ).not.toBe(
      deriveFamilyOwnerId(config, 'auth0|stable-subject', 'new@example.com')
    );
  });
});
