const express = require('express');
const { v4: uuid } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const { logActivity } = require('../middleware/logger');

const router = express.Router();

const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'), 'photos');

if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuid()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.post('/', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  const id = uuid();
  const { asset_id, issue_id, caption } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO photos (id, asset_id, issue_id, filename, mime_type, caption, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, asset_id || null, issue_id || null, req.file.filename, req.file.mimetype, caption || null, now);

  const entityType = asset_id ? 'asset' : 'issue';
  const entityId = asset_id || issue_id;
  if (entityId) {
    logActivity({ entityType, entityId, action: 'photo_added', changes: { photo_id: id }, userLabel: req.headers['x-user-label'] });
  }

  res.status(201).json({ id, filename: req.file.filename, mime_type: req.file.mimetype, caption, created_at: now });
});

router.get('/:id/file', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const filePath = path.join(PHOTOS_DIR, photo.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.type(photo.mime_type);
  res.sendFile(filePath);
});

router.delete('/:id', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const filePath = path.join(PHOTOS_DIR, photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);

  const entityType = photo.asset_id ? 'asset' : 'issue';
  const entityId = photo.asset_id || photo.issue_id;
  if (entityId) {
    logActivity({ entityType, entityId, action: 'photo_removed', changes: { photo_id: photo.id }, userLabel: req.headers['x-user-label'] });
  }

  res.json({ ok: true });
});

module.exports = router;
