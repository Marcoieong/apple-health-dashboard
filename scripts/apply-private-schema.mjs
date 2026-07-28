import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.CHATGPT_MCP_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const schemaPath = fileURLToPath(
  new URL('../server/meal-photo-mcp/schema.sql', import.meta.url)
);
const schema = await readFile(schemaPath, 'utf8');
const statements = schema
  .replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(databaseUrl);
await sql.query(`
  create table if not exists private_schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`);

const version = 'meal-photo-v1';
const existing = await sql.query(
  'select version from private_schema_migrations where version = $1',
  [version]
);

if (existing.length === 0) {
  await sql.transaction((transaction) => [
    ...statements.map((statement) => transaction.query(statement)),
    transaction.query(
      'insert into private_schema_migrations (version) values ($1)',
      [version]
    )
  ]);
  process.stdout.write(`Applied private schema ${version}.\n`);
} else {
  process.stdout.write(`Private schema ${version} is already applied.\n`);
}
