const express = require('express');
const db = require('../db/connection');

const router = express.Router();

function toCsv(rows, columns) {
  if (!rows.length) return columns.join(',') + '\n';
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');
  return header + '\n' + body + '\n';
}

router.get('/assets', (req, res) => {
  const assets = db.prepare('SELECT * FROM assets ORDER BY name').all();
  const format = req.query.format || 'json';

  if (format === 'csv') {
    const columns = ['id', 'name', 'serial_number', 'location', 'category', 'manufacturer', 'model', 'purchase_date', 'warranty_exp', 'notes', 'status', 'created_at', 'updated_at'];
    const csv = toCsv(assets, columns);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gattitown-assets-${date}.csv"`);
    return res.send(csv);
  }

  res.json(assets);
});

router.get('/issues', (req, res) => {
  const issues = db.prepare('SELECT * FROM issues ORDER BY created_at DESC').all();
  const format = req.query.format || 'json';

  if (format === 'csv') {
    const columns = ['id', 'asset_id', 'name', 'description', 'status', 'priority', 'resolved', 'resolved_at', 'created_at', 'updated_at'];
    const csv = toCsv(issues, columns);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gattitown-issues-${date}.csv"`);
    return res.send(csv);
  }

  res.json(issues);
});

module.exports = router;
