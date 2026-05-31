/**
 * Database Schema Upgrade
 * Safe migration for SQLite schema.
 * Creates tables if they do not exist. No destructive changes.
 */

export const SCHEMA_VERSION = 5;

export const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business TEXT,
    budget REAL,
    preferences TEXT,
    history TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    product_type TEXT,
    tech_stack TEXT,
    status TEXT,
    phases TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS phases (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    phase_id TEXT,
    name TEXT,
    status TEXT,
    worker TEXT,
    duration INTEGER,
    started_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    status TEXT,
    last_run INTEGER,
    success_rate REAL
  )`,
  `CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    worker_id TEXT,
    skill_name TEXT,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used INTEGER,
    FOREIGN KEY (worker_id) REFERENCES workers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS search_index (
    project_id TEXT PRIMARY KEY,
    content TEXT,
    keywords TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    message TEXT,
    context TEXT,
    timestamp INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER
  )`
];

export async function upgradeDatabase(db) {
  try {
    // Enable foreign keys
    await db.execute('PRAGMA foreign_keys = ON');

    // Check current version
    let currentVersion = 0;
    try {
      const versionRows = await db.select(
        'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
      );
      if (versionRows.length > 0) {
        currentVersion = versionRows[0].version;
      }
    } catch {
      // Table might not exist yet
      currentVersion = 0;
    }

    if (currentVersion >= SCHEMA_VERSION) {
      return { success: true, message: 'Schema up to date', version: currentVersion };
    }

    // Create tables
    for (const sql of CREATE_TABLES_SQL) {
      await db.execute(sql);
    }

    // Insert or update version
    await db.execute(
      'INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)',
      [SCHEMA_VERSION, Date.now()]
    );

    return {
      success: true,
      message: `Schema upgraded from ${currentVersion} to ${SCHEMA_VERSION}`,
      previousVersion: currentVersion,
      newVersion: SCHEMA_VERSION
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default upgradeDatabase;
