import Database from '@tauri-apps/plugin-sql';
import { resolveAppPaths } from '@/lib/runtime';
import { STORAGE_SCHEMA } from '@/modules/storage/schema';

let databasePromise: Promise<Database> | null = null;

async function openDatabase(): Promise<Database> {
  const paths = await resolveAppPaths();
  const database = await Database.load(paths.database_url);

  await database.execute('PRAGMA foreign_keys = ON');
  await database.execute('PRAGMA journal_mode = WAL');

  for (const statement of STORAGE_SCHEMA) {
    try {
      await database.execute(statement);
    } catch {
      // Ignore migration errors (e.g. column already exists)
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
