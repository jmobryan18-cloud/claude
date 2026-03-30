const db = require('./connection');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      serial_number TEXT,
      location      TEXT,
      category      TEXT,
      manufacturer  TEXT,
      model         TEXT,
      purchase_date TEXT,
      warranty_exp  TEXT,
      notes         TEXT,
      status        TEXT DEFAULT 'ACTIVE',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues (
      id          TEXT PRIMARY KEY,
      asset_id    TEXT REFERENCES assets(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      status      TEXT,
      priority    TEXT NOT NULL CHECK(priority IN ('CRITICAL','HIGH','MEDIUM','MONITOR')),
      resolved    INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id         TEXT PRIMARY KEY,
      asset_id   TEXT REFERENCES assets(id) ON DELETE CASCADE,
      issue_id   TEXT REFERENCES issues(id) ON DELETE SET NULL,
      filename   TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      caption    TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id          TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      action      TEXT NOT NULL,
      changes     TEXT,
      user_label  TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_issues_asset_id ON issues(asset_id);
    CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
    CREATE INDEX IF NOT EXISTS idx_issues_resolved ON issues(resolved);
    CREATE INDEX IF NOT EXISTS idx_photos_asset_id ON photos(asset_id);
    CREATE INDEX IF NOT EXISTS idx_photos_issue_id ON photos(issue_id);
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
  `);
}

module.exports = { initialize };
