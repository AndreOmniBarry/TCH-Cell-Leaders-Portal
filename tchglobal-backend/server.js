// server.js — TCH Global Attendance API entry point

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const authRoutes       = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS ─────────────────────────────────────────────────
// Add your GitHub Pages URL here before deploying
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// ── Health check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status  : 'TCH Global Attendance API is running',
    version : '1.0.0',
    time    : new Date().toISOString(),
  });
});

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/attendance', attendanceRoutes);

// ── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found` });
});

// ── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅  TCH Global server running → http://localhost:${PORT}`);
  console.log(`    Environment: ${process.env.NODE_ENV}`);
});