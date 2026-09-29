export interface ImportedHealthAdviceConfig {
  databaseUrl: string;
}

export function loadImportedHealthAdviceConfig(
  env: NodeJS.ProcessEnv = process.env
): ImportedHealthAdviceConfig {
  const value =
    env.IMPORTED_HEALTH_ADVICE_DATABASE_URL?.trim() ||
    env.DATABASE_URL?.trim() ||
    env.CHATGPT_MCP_DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      'IMPORTED_HEALTH_ADVICE_DATABASE_URL or DATABASE_URL is missing.'
    );
  }

  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Imported health advice database URL must use PostgreSQL.');
  }
  if (parsed.searchParams.get('sslmode')?.toLowerCase() === 'disable') {
    throw new Error('Imported health advice database URL must not disable TLS.');
  }

  return { databaseUrl: parsed.href };
}
