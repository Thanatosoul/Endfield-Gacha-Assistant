import Database from '@tauri-apps/plugin-sql';
import { resolveAppPaths } from '@/lib/runtime';
import { STORAGE_SCHEMA } from '@/modules/storage/schema';

let databasePromise: Promise<Database> | null = null;

const BENIGN_MIGRATION_ERROR = /duplicate column name|already exists/i;

function isBenignMigrationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return BENIGN_MIGRATION_ERROR.test(message);
}

async function openDatabase(): Promise<Database> {
  const paths = await resolveAppPaths();
  const database = await Database.load(paths.database_url);

  await database.execute('PRAGMA foreign_keys = ON');
  await database.execute('PRAGMA journal_mode = WAL');

  for (const statement of STORAGE_SCHEMA) {
    try {
      await database.execute(statement);
    } catch (error) {
      // The schema is written to be idempotent, so re-running it on an existing
      // database raises "duplicate column"/"already exists". Anything else is a
      // real migration problem and must not be swallowed silently.
      if (isBenignMigrationError(error)) continue;
      console.error('[storage] schema statement failed:', (error as Error)?.message ?? error);
    }
  }

  return database;
}

export async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }

  return databasePromise;
}

export async function bootstrapStorage(): Promise<{ databaseUrl: string }> {
  const paths = await resolveAppPaths();
  await getDatabase();
  return { databaseUrl: paths.database_url };
}
