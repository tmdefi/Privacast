const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'privacast.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ── TABLES ──
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    UNIQUE NOT NULL,
    email      TEXT    UNIQUE NOT NULL,
    password   TEXT    NOT NULL,
    balance    REAL    DEFAULT 1000,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    market_id  TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    side       TEXT    NOT NULL CHECK(side IN ('YES','NO')),
    amount     REAL    NOT NULL CHECK(amount > 0),
    prob_at_bet REAL,
    resolved   INTEGER DEFAULT 0,
    outcome    TEXT,
    payout     REAL    DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now')),
    UNIQUE(user_id, market_id)
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id),
    total_bets    INTEGER DEFAULT 0,
    correct_bets  INTEGER DEFAULT 0,
    total_wagered REAL    DEFAULT 0,
    total_payout  REAL    DEFAULT 0,
    score         REAL    DEFAULT 0,
    updated_at    TEXT    DEFAULT (datetime('now'))
  );
`);

module.exports = db;
