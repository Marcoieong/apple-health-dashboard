import { createHash, timingSafeEqual } from 'node:crypto';

export interface ShortcutRuntimeConfig {
  accessToken: string;
  ownerId: string;
}

export function loadShortcutRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ShortcutRuntimeConfig {
  const accessToken = env.SHORTCUT_ACCESS_TOKEN?.trim();
  const ownerId = env.SHORTCUT_OWNER_ID?.trim();

  if (!accessToken || accessToken.length < 32 || !ownerId || ownerId.length > 128) {
    throw new Error('Shortcut private access configuration is incomplete.');
  }

  return { accessToken, ownerId };
}

export function extractShortcutBearerToken(
  authorization: string | string[] | undefined
): string | undefined {
  const value = Array.isArray(authorization)
    ? authorization[0]
    : authorization;
  const match = /^Bearer ([^\s]+)$/i.exec(value ?? '');
  return match?.[1];
}

export function isValidShortcutToken(
  suppliedToken: string | undefined,
  expectedToken: string
): boolean {
  if (!suppliedToken) return false;
  const suppliedDigest = createHash('sha256').update(suppliedToken).digest();
  const expectedDigest = createHash('sha256').update(expectedToken).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}
