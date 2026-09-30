import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const databaseUrl =
  process.env.IMPORTED_HEALTH_ADVICE_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.CHATGPT_MCP_DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    'IMPORTED_HEALTH_ADVICE_DATABASE_URL or DATABASE_URL is required.'
  );
}

const sql = neon(databaseUrl);
await sql.query(`
  create table if not exists private_schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`);

const migrations = [
  {
    version: 'imported-health-advice-v1',
    url: new URL(
      '../server/imported-health-advice/migrations/imported-health-advice-v1.sql',
      import.meta.url
    )
  },
  {
    version: 'imported-health-advice-v2-shortcut',
    url: new URL(
      '../server/imported-health-advice/migrations/imported-health-advice-v2-shortcut.sql',
      import.meta.url
    )
  }
];

for (const migration of migrations) {
  const existing = await sql.query(
    'select version from private_schema_migrations where version = $1',
    [migration.version]
  );
  if (existing.length > 0) {
    process.stdout.write(
      `Imported advice schema ${migration.version} is already applied.\n`
    );
    continue;
  }

  const source = await readFile(fileURLToPath(migration.url), 'utf8');
  const statements = source
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  await sql.transaction((transaction) => [
    ...statements.map((statement) => transaction.query(statement)),
    transaction.query(
      'insert into private_schema_migrations (version) values ($1)',
      [migration.version]
    )
  ]);
  process.stdout.write(`Applied imported advice schema ${migration.version}.\n`);
}
