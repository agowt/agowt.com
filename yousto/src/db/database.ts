import { open, DB } from '@op-engineering/op-sqlite';
import { migrations } from './schema';

let db: DB | null = null;

export const initDB = () => {
  if (!db) {
    db = open({ name: 'yousto.sqlite' });

    try {
      // ── Version tracking via PRAGMA user_version ──────────────────────────
      // This is SQLite's built-in integer version field — more reliable than
      // a __migrations table because PRAGMA reads work outside transactions
      // and never produce the "table already exists" pitfall.
      const vResult = db.execute('PRAGMA user_version');
      const currentVersion: number = (vResult.rows?.[0] as any)?.user_version ?? 0;

      // Only apply migrations whose version is newer than the stored version
      const pending = migrations.filter(m => m.version > currentVersion);

      if (pending.length > 0) {
        db.transaction((tx) => {
          pending.forEach(migration => {
            migration.queries.forEach(query => {
              try {
                tx.execute(query);
              } catch (queryErr: any) {
                // Idempotency guard: swallow "already exists" / "duplicate column"
                // errors so a migration that partially ran can be safely retried.
                const msg: string = queryErr?.message ?? '';
                if (
                  msg.includes('already exists') ||
                  msg.includes('duplicate column name')
                ) {
                  console.warn(`[DB] Skipping idempotent error in migration v${migration.version}: ${msg}`);
                  return;
                }
                throw queryErr; // Surface genuine errors
              }
            });
            console.log(`[DB] Applied migration v${migration.version}`);
          });
        });

        // Persist the highest version we just applied
        const latestVersion = Math.max(...pending.map(m => m.version));
        db.execute(`PRAGMA user_version = ${latestVersion}`);
      }

      console.log('Database initialized and migrated successfully.');
    } catch (e) {
      console.error('Migration error:', e);
      throw e;
    }
  }
  return db;
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDB first.');
  }
  return db;
};

// Typed helper for executing async queries safely
export const executeQuery = async (query: string, params: any[] = []) => {
  const instance = getDB();
  return await instance.executeAsync(query, params);
};
