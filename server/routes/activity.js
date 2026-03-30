const express = require('express');
const db = require('../db/connection');

const router = express.Router();

router.get('/', (req, res) => {
  const { entity_type, entity_id, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM activity_log WHERE 1=1';
  const params = [];

  if (entity_type) {
    sql += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (entity_id) {
    sql += ' AND entity_id = ?';
    params.push(entity_id);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

module.exports = router;
