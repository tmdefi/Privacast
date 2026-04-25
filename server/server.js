const express = require('express');
const cors = require('cors');
const path = require('path');

const { router: authRouter } = require('./routes/auth');
const predictionsRouter = require('./routes/predictions');
const leaderboardRouter = require('./routes/leaderboard');

const app = express();
const PORT = process.env.PORT || 3001;

// ── MIDDLEWARE ──
app.use(cors({ origin: '*' })); // allow frontend on any port
app.use(express.json());

// Serve the frontend from parent folder
app.use(express.static(path.join(__dirname, '..')));

// ── ROUTES ──
app.use('/api/auth', authRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', stage: 2 }));

// Catch-all: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ██████╗ ██████╗ ██╗██╗   ██╗ █████╗  ██████╗ █████╗ ███████╗████████╗
  ██╔══██╗██╔══██╗██║██║   ██║██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝
  ██████╔╝██████╔╝██║██║   ██║███████║██║     ███████║███████╗   ██║   
  ██╔═══╝ ██╔══██╗██║╚██╗ ██╔╝██╔══██║██║     ██╔══██║╚════██║   ██║   
  ██║     ██║  ██║██║ ╚████╔╝ ██║  ██║╚██████╗██║  ██║███████║   ██║   
  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝   

  Stage 2 server running → http://localhost:${PORT}
  API ready:
    POST /api/auth/register
    POST /api/auth/login
    GET  /api/auth/me
    GET  /api/predictions
    POST /api/predictions
    GET  /api/leaderboard
  `);
});
