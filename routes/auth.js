const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'privacast-secret-change-in-production';

// ── MIDDLEWARE: verify token ──
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── REGISTER ──
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Username, email and password required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(username.trim(), email.trim().toLowerCase(), hash);

    // Init leaderboard entry
    db.prepare('INSERT INTO leaderboard (user_id) VALUES (?)').run(result.lastInsertRowid);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username: username.trim() },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, username: username.trim(), balance: 1000 });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ── LOGIN ──
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, username: user.username, balance: user.balance });
});

// ── ME (get current user) ──
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, balance, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = { router, auth };
