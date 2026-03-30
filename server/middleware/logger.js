const { v4: uuid } = require('uuid');
const db = require('../db/connection');

const insert = db.prepare(`
  INSERT INTO activity_log (id, entity_type, entity_id, action, changes, user_label, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function logActivity({ entityType, entityId, action, changes = null, userLabel = null }) {
  insert.run(
    uuid(),
    entityType,
    entityId,
    action,
    changes ? JSON.stringify(changes) : null,
    userLabel,
    new Date().toISOString()
  );
}

function diffChanges(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    if (before[field] !== after[field]) {
      changes[field] = { from: before[field], to: after[field] };
    }
  }
  return Object.keys(changes).length ? changes : null;
}

module.exports = { logActivity, diffChanges };
