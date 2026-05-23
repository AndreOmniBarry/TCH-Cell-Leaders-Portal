// routes/attendance.js
// Receives submitted attendance records and stores them in memory.
// Swap the in-memory array for a real DB insert in production.

const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

// In-memory store — resets when server restarts.
// Good enough for demo. Replace with DB in production.
const records = [];

// ── Auth middleware ──────────────────────────────────────
// Verifies the Bearer token on every protected route.
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token — please log in again.',
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      message: expired
        ? 'Session expired — please log in again.'
        : 'Invalid token — please log in again.',
    });
  }
}

// ── POST /api/attendance/submit ──────────────────────────
// Receives a full session record from the frontend.
router.post('/submit', authenticate, (req, res) => {
  const record = req.body;

  // Cell leaders can only submit for their own cell
  if (!record || record.cellKey !== req.user.cellKey) {
    return res.status(403).json({
      success: false,
      message: 'You can only submit attendance for your own cell.',
    });
  }

  // Basic shape check
  if (!record.serviceDate || !Array.isArray(record.members)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid attendance record — missing date or members.',
    });
  }

  // Prevent duplicate submission for same cell + same date
  const duplicate = records.find(
    r => r.cellKey === record.cellKey && r.serviceDate === record.serviceDate
  );
  if (duplicate) {
    return res.status(409).json({
      success : false,
      message : `Attendance for ${record.cellName} on ${record.serviceDate} was already submitted.`,
    });
  }

  // Save
  const saved = {
    ...record,
    receivedAt  : new Date().toISOString(),
    submittedBy : req.user.leader,
  };
  records.push(saved);

  const present = record.members.filter(m => m.status === 'present').length;
  const absent  = record.members.filter(m => m.status === 'absent').length;

  console.log(
    `[ATTENDANCE] ${record.cellName} | ${record.serviceDate} | ` +
    `Present: ${present} | Absent: ${absent} | By: ${req.user.leader}`
  );

  res.status(201).json({
    success : true,
    message : 'Attendance recorded successfully.',
    summary : { cellName: record.cellName, date: record.serviceDate, present, absent },
  });
});

// ── GET /api/attendance/history ──────────────────────────
// Returns all past sessions for the logged-in cell leader's cell.
router.get('/history', authenticate, (req, res) => {
  const cellRecords = records
    .filter(r => r.cellKey === req.user.cellKey)
    .sort((a, b) => new Date(b.serviceDate) - new Date(a.serviceDate));

  res.json({
    success : true,
    count   : cellRecords.length,
    records : cellRecords,
  });
});

// ── GET /api/attendance/all ──────────────────────────────
// Returns every cell's records — for admin dashboard later.
// Protect this with an admin role check before going to production.
router.get('/all', authenticate, (req, res) => {
  res.json({
    success : true,
    count   : records.length,
    records : records.sort((a, b) => new Date(b.serviceDate) - new Date(a.serviceDate)),
  });
});

module.exports = router;