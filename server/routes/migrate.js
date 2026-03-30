const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/connection');
const { logActivity } = require('../middleware/logger');

const router = express.Router();

router.post('/', (req, res) => {
  const { issues: legacyIssues } = req.body;
  if (!Array.isArray(legacyIssues)) {
    return res.status(400).json({ error: 'Expected { issues: [...] }' });
  }

  const insertAsset = db.prepare(`
    INSERT OR IGNORE INTO assets (id, name, status, created_at, updated_at)
    VALUES (?, ?, 'ACTIVE', ?, ?)
  `);

  const insertIssue = db.prepare(`
    INSERT OR IGNORE INTO issues (id, asset_id, name, description, status, priority, resolved, resolved_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const assetMap = new Map();
  let issueCount = 0;
  let assetCount = 0;

  const migrate = db.transaction(() => {
    for (const legacy of legacyIssues) {
      const machineName = (legacy.name || '').trim();
      if (!machineName) continue;

      // Create stub asset from unique machine names
      if (!assetMap.has(machineName.toLowerCase())) {
        const assetId = uuid();
        const assetTs = new Date(legacy.ts || Date.now()).toISOString();
        insertAsset.run(assetId, machineName, assetTs, assetTs);
        assetMap.set(machineName.toLowerCase(), assetId);
        assetCount++;
      }

      const assetId = assetMap.get(machineName.toLowerCase());
      const ts = new Date(legacy.ts || Date.now()).toISOString();
      const issueId = legacy.id || uuid();

      insertIssue.run(
        issueId,
        assetId,
        machineName,
        legacy.issue || legacy.description || '',
        legacy.status || null,
        legacy.priority || 'MEDIUM',
        legacy.resolved ? 1 : 0,
        legacy.resolved ? ts : null,
        ts,
        ts
      );
      issueCount++;
    }
  });

  migrate();

  logActivity({ entityType: 'system', entityId: 'migration', action: 'migrated', changes: { issues: issueCount, assets: assetCount } });

  res.json({ ok: true, assets_created: assetCount, issues_imported: issueCount });
});

module.exports = router;
