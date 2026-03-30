const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/connection');
const { logActivity, diffChanges } = require('../middleware/logger');

const router = express.Router();

const ASSET_FIELDS = ['name', 'serial_number', 'location', 'category', 'manufacturer', 'model', 'purchase_date', 'warranty_exp', 'notes', 'status'];

router.get('/', (req, res) => {
  const { q, status, category } = req.query;
  let sql = 'SELECT * FROM assets WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR serial_number LIKE ? OR location LIKE ? OR notes LIKE ?)';
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY CASE status WHEN \'ACTIVE\' THEN 0 WHEN \'DOWN\' THEN 1 ELSE 2 END, name';
  const assets = db.prepare(sql).all(...params);
  res.json(assets);
});

router.get('/:id', (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const issues = db.prepare('SELECT * FROM issues WHERE asset_id = ? ORDER BY resolved, created_at DESC').all(req.params.id);
  const photos = db.prepare('SELECT id, caption, mime_type, created_at FROM photos WHERE asset_id = ? ORDER BY created_at DESC').all(req.params.id);

  res.json({ ...asset, issues, photos });
});

router.post('/', (req, res) => {
  const id = req.body.id || uuid();
  const now = new Date().toISOString();
  const { name, serial_number, location, category, manufacturer, model, purchase_date, warranty_exp, notes, status } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  db.prepare(`
    INSERT INTO assets (id, name, serial_number, location, category, manufacturer, model, purchase_date, warranty_exp, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, serial_number || null, location || null, category || null, manufacturer || null, model || null, purchase_date || null, warranty_exp || null, notes || null, status || 'ACTIVE', now, now);

  logActivity({ entityType: 'asset', entityId: id, action: 'created', userLabel: req.headers['x-user-label'] });

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  res.status(201).json(asset);
});

router.put('/:id', (req, res) => {
  const before = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Asset not found' });

  const now = new Date().toISOString();
  const updates = {};
  for (const field of ASSET_FIELDS) {
    updates[field] = req.body[field] !== undefined ? req.body[field] : before[field];
  }

  db.prepare(`
    UPDATE assets SET name=?, serial_number=?, location=?, category=?, manufacturer=?, model=?, purchase_date=?, warranty_exp=?, notes=?, status=?, updated_at=?
    WHERE id=?
  `).run(updates.name, updates.serial_number, updates.location, updates.category, updates.manufacturer, updates.model, updates.purchase_date, updates.warranty_exp, updates.notes, updates.status, now, req.params.id);

  const changes = diffChanges(before, updates, ASSET_FIELDS);
  if (changes) {
    logActivity({ entityType: 'asset', entityId: req.params.id, action: 'updated', changes, userLabel: req.headers['x-user-label'] });
  }

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  res.json(asset);
});

router.delete('/:id', (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
  logActivity({ entityType: 'asset', entityId: req.params.id, action: 'deleted', userLabel: req.headers['x-user-label'] });

  res.json({ ok: true });
});

module.exports = router;
