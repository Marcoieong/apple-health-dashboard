import {
  isValidShortcutToken,
  loadShortcutRuntimeConfig
} from '../meal-photo-mcp/shortcutAuth.js';
import {
  authenticateFamilyShortcutToken,
  loadShortcutCredentialConfig
} from './shortcutCredentials.js';

export async function resolveShortcutOwner(
  suppliedToken: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  if (!suppliedToken) return undefined;

  try {
    const familyOwner = await authenticateFamilyShortcutToken(
      suppliedToken,
      loadShortcutCredentialConfig(env)
    );
    if (familyOwner) return familyOwner;
  } catch {
    // Family credentials may not be deployed yet. Keep the proven legacy
    // Shortcut working during the migration instead of weakening either path.
  }

  try {
    const legacy = loadShortcutRuntimeConfig(env);
    return isValidShortcutToken(suppliedToken, legacy.accessToken)
      ? legacy.ownerId
      : undefined;
  } catch {
    return undefined;
  }
}
