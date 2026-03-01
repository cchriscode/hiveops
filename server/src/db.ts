import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.HIVEOPS_DB_PATH
  || path.join(__dirname, "..", "data", "hiveops.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo','claimed','in_progress','review','done')),
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','critical')),
      category TEXT NOT NULL DEFAULT '',
      project TEXT NOT NULL DEFAULT 'default',
      agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      claimed_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'system',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent);
    CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'system',
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_task_id ON activity_log(task_id);

    CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, depends_on_id)
    );

    CREATE INDEX IF NOT EXISTS idx_deps_task_id ON task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS idx_deps_depends_on ON task_dependencies(depends_on_id);
  `);

  // Add type column to comments (idempotent)
  try {
    db.exec(`ALTER TABLE comments ADD COLUMN type TEXT NOT NULL DEFAULT 'comment'`);
  } catch (_) {
    // Column already exists
  }

  // task_files table (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_files (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      PRIMARY KEY (task_id, file_path)
    );
    CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id);
  `);
}
