const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/connection');
const { logActivity, diffChanges } = require('../middleware/logger');

const router = express.Router();

const ISSUE_FIELDS = ['name', 'description', 'status', 'priority', 'asset_id'];

router.get('/', (req, res) => {
  const { q, priority, resolved, asset_id } = req.query;
  let sql = 'SELECT * FROM issues WHERE 1=1';
  const params = [];

  if (priority) {
    sql += ' AND priority = ?';
    params.push(priority);
  }
  if (resolved !== undefined) {
    sql += ' AND resolved = ?';
    params.push(resolved === 'true' || resolved === '1' ? 1 : 0);
  }
  if (asset_id) {
    sql += ' AND asset_id = ?';
    params.push(asset_id);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR description LIKE ? OR status LIKE ?)';
    const term = `%${q}%`;
    params.push(term, term, term);
  }

  sql += ` ORDER BY resolved,
    CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
    created_at DESC`;

  const issues = db.prepare(sql).all(...params);
  res.json(issues);
});

router.get('/:id', (req, res) => {
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  const photos = db.prepare('SELECT id, caption, mime_type, created_at FROM photos WHERE issue_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...issue, photos });
});

router.post('/', (req, res) => {
  const id = req.body.id || uuid();
  const now = new Date().toISOString();
  const { name, description, status, priority, asset_id } = req.body;

  if (!name || !description) return res.status(400).json({ error: 'Name and description are required' });
  if (!['CRITICAL', 'HIGH', 'MEDIUM', 'MONITOR'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  db.prepare(`
    INSERT INTO issues (id, asset_id, name, description, status, priority, resolved, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, asset_id || null, name, description, status || null, priority, now, now);

  logActivity({ entityType: 'issue', entityId: id, action: 'created', userLabel: req.headers['x-user-label'] });

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
  res.status(201).json(issue);
});

router.put('/:id', (req, res) => {
  const before = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Issue not found' });

  const now = new Date().toISOString();
  const updates = {};
  for (const field of ISSUE_FIELDS) {
    updates[field] = req.body[field] !== undefined ? req.body[field] : before[field];
  }

  db.prepare(`
    UPDATE issues SET asset_id=?, name=?, description=?, status=?, priority=?, updated_at=?
    WHERE id=?
  `).run(updates.asset_id, updates.name, updates.description, updates.status, updates.priority, now, req.params.id);

  const changes = diffChanges(before, updates, ISSUE_FIELDS);
  if (changes) {
    logActivity({ entityType: 'issue', entityId: req.params.id, action: 'updated', changes, userLabel: req.headers['x-user-label'] });
  }

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  res.json(issue);
});

router.put('/:id/resolve', (req, res) => {
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  const now = new Date().toISOString();
  const newResolved = issue.resolved ? 0 : 1;
  const resolvedAt = newResolved ? now : null;

  db.prepare('UPDATE issues SET resolved=?, resolved_at=?, updated_at=? WHERE id=?')
    .run(newResolved, resolvedAt, now, req.params.id);

  const action = newResolved ? 'resolved' : 'reopened';
  logActivity({ entityType: 'issue', entityId: req.params.id, action, userLabel: req.headers['x-user-label'] });

  const updated = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id);
  logActivity({ entityType: 'issue', entityId: req.params.id, action: 'deleted', userLabel: req.headers['x-user-label'] });

  res.json({ ok: true });
});

module.exports = router;
