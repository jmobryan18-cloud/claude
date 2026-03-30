const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { initialize } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initialize();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api/assets', require('./routes/assets'));
app.use('/api/issues', require('./routes/issues'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/export', require('./routes/export'));
app.use('/api/migrate', require('./routes/migrate'));

// Search endpoint (cross-entity)
const db = require('./db/connection');
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ assets: [], issues: [] });

  const term = `%${q}%`;
  const assets = db.prepare(
    'SELECT * FROM assets WHERE name LIKE ? OR serial_number LIKE ? OR location LIKE ? OR notes LIKE ? LIMIT 20'
  ).all(term, term, term, term);

  const issues = db.prepare(
    'SELECT * FROM issues WHERE name LIKE ? OR description LIKE ? OR status LIKE ? LIMIT 20'
  ).all(term, term, term);

  res.json({ assets, issues });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gattitown server running on port ${PORT}`);
});
