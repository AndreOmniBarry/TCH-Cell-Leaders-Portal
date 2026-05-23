// routes/auth.js
// Handles cell leader login and returns a signed JWT + cell data.

const express = require('express');
const jwt     = require('jsonwebtoken');
const cells   = require('../data/cells');
const router  = express.Router();

// Demo credentials — one per cell leader.
// Format: { cellKey, username (phone), password }
// Replace with real DB lookup when database is ready.
const LEADERS = [
  { cellKey: 'powerhouse', username: '08031120001', password: 'tch@power2024'    },
  { cellKey: 'achievers',  username: '08031110001', password: 'tch@achiev2024'   },
  { cellKey: 'champions',  username: '08011112001', password: 'tch@champ2024'    },
  { cellKey: 'victorious', username: '08031113001', password: 'tch@victor2024'   },
  { cellKey: 'overcomers', username: '08061114001', password: 'tch@overcome2024' },
  { cellKey: 'glory',      username: '08031115001', password: 'tch@glory2024'    },
  { cellKey: 'covenant',   username: '08031116001', password: 'tch@covenant2024' },
  { cellKey: 'excel',      username: '08031117001', password: 'tch@excel2024'    },
  { cellKey: 'dominion',   username: '08031118001', password: 'tch@dominion2024' },
  { cellKey: 'grace',      username: '08031119001', password: 'tch@grace2024'    },
  { cellKey: 'destiny',    username: '08031120011', password: 'tch@destiny2024'  },
  { cellKey: 'kingdom',    username: '08031120021', password: 'tch@kingdom2024'  },
  { cellKey: 'sunrise',    username: '08031120031', password: 'tch@sunrise2024'  },
  { cellKey: 'harvest',    username: '08031120041', password: 'tch@harvest2024'  },
  { cellKey: 'eagles',     username: '08031120051', password: 'tch@eagles2024'   },
  { cellKey: 'nobles',     username: '08031120061', password: 'tch@nobles2024'   },
  { cellKey: 'zion',       username: '08031120071', password: 'tch@zion2024'     },
  { cellKey: 'lighthouse', username: '08031120081', password: 'tch@lighthouse2024'},
  { cellKey: 'manifold',   username: '08031120091', password: 'tch@manifold2024' },
  { cellKey: 'conquerors', username: '08031120101', password: 'tch@conquer2024'  },
];

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { cellKey, username, password } = req.body;

  // Basic input check
  if (!cellKey || !username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Cell group, phone number, and password are all required.',
    });
  }

  // Find matching leader record
  const leader = LEADERS.find(
    l => l.cellKey === cellKey &&
         l.username === username.replace(/[\s-]/g, '') // strip spaces/dashes
  );

  // Wrong cell or username
  if (!leader) {
    return res.status(401).json({
      success: false,
      message: 'No account found for this cell and phone number.',
    });
  }

  // Wrong password
  if (leader.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Incorrect password. Please try again.',
    });
  }

  // Get cell data
  const cell = cells[cellKey];
  if (!cell) {
    return res.status(500).json({
      success: false,
      message: 'Cell data not found. Contact your administrator.',
    });
  }

  // Sign JWT — expires in 8 hours (covers a full Sunday)
  const token = jwt.sign(
    { cellKey, leader: cell.leader },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    success : true,
    token,
    cell    : {
      cellName : cell.cellName,
      leader   : cell.leader,
      members  : cell.members,
    },
  });
});

module.exports = router;