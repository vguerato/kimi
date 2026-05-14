import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.resolve(dataDir, 'database.sqlite');

export const db = new sqlite3.Database(dbPath);

export function dbInit(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Config table for storing settings (Jira token, Git PAT, Repos directory)
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `, (err) => {
        if (err) return reject(err);
      });

      // Tasks table for tracking delegated sub-tasks
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          parent_id TEXT,
          repository TEXT,
          branch TEXT,
          status TEXT,
          logs TEXT,
          model TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);

        // Migration: add 'model' column if it doesn't exist yet (for existing DBs)
        db.run(`ALTER TABLE tasks ADD COLUMN model TEXT`, () => {
          // Ignore error — column may already exist

          // Migration: add 'commit_url' column if it doesn't exist yet
          db.run(`ALTER TABLE tasks ADD COLUMN commit_url TEXT`, () => {
            // Ignore error — column may already exist
            resolve();
          });
        });
      });
    });
  });
}

// Utility to run queries with promises
export function runQuery(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function executeQuery(query: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}
