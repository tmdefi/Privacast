const express = require('express');
const db = require('../database');
const { auth } = require('./auth');

const router = express.Router();

// ── GET all predictions for logged-in user ──
router.get('/', auth, (req, res) => {
  const predictions = db.prepare(
    'SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(predictions);
});

// ── PLACE a prediction ──
router.post('/', auth, (req, res) => {
  const { market_id, title, side, amount, prob_at_bet } = req.body;

  if (!market_id || !title || !side || !amount)
    return res.status(400).json({ error: 'market_id, title, side and amount are required' });
  if (!['YES', 'NO'].includes(side))
    return res.status(400).json({ error: 'side must be YES or NO' });
  if (amount <= 0)
    return res.status(400).json({ error: 'amount must be positive' });

  // Check balance
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
  if (user.balance < amount)
    return res.status(400).json({ error: 'Insufficient balance' });

  try {
    // Deduct balance
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, req.user.id);

    // Save prediction (update if same market)
    const stmt = db.prepare(`
      INSERT INTO predictions (user_id, market_id, title, side, amount, prob_at_bet)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, market_id) DO UPDATE SET
        side = excluded.side,
        amount = amount + excluded.amount,
        prob_at_bet = excluded.prob_at_bet
    `);
    stmt.run(req.user.id, market_id, title, side, amount, prob_at_bet || null);

    // Update leaderboard totals
    db.prepare(`
      UPDATE leaderboard SET
        total_bets = total_bets + 1,
        total_wagered = total_wagered + ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(amount, req.user.id);

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id).balance;
    res.json({ success: true, new_balance: newBalance });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error placing prediction' });
  }
});

// ── DELETE a prediction ──
router.delete('/:market_id', auth, (req, res) => {
  const pred = db.prepare(
    'SELECT * FROM predictions WHERE user_id = ? AND market_id = ?'
  ).get(req.user.id, req.params.market_id);

  if (!pred) return res.status(404).json({ error: 'Prediction not found' });
  if (pred.resolved) return res.status(400).json({ error: 'Cannot delete a resolved prediction' });

  // Refund
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(pred.amount, req.user.id);
  db.prepare('DELETE FROM predictions WHERE user_id = ? AND market_id = ?').run(req.user.id, req.params.market_id);

  const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id).balance;
  res.json({ success: true, refunded: pred.amount, new_balance: newBalance });
});

module.exports = router;
