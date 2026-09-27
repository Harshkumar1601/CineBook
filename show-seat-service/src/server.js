// ============================================================
// SHOW/SEAT SERVICE - server.js
// Port: 8004
// Responsible for shows, theatres, and seat management
// Implements SEAT LOCKING for concurrency control
// ============================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const showRoutes = require('./routes/showRoutes');

const app = express();
const PORT = process.env.PORT || 8004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticket_shows';

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/shows', showRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'show-seat-service', port: PORT });
});

// ── MongoDB connection ───────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('[SHOW/SEAT SERVICE] MongoDB connected → ticket_shows');
    await seedShows();
    app.listen(PORT, () => {
      console.log(`[SHOW/SEAT SERVICE] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[SHOW/SEAT SERVICE] MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Helper: Generate seat grid ────────────────────────────────
function generateSeats(priceMap = {}) {
  const rows = ['A', 'B', 'C', 'D'];
  const cols = [1, 2, 3, 4, 5];
  const seats = [];
  rows.forEach((row) => {
    cols.forEach((col) => {
      const seatNumber = `${row}${col}`;
      seats.push({
        seatNumber,
        status: 'AVAILABLE',
        price: priceMap[row] || 200,
        lockedAt: null,
        lockedBy: null,
      });
    });
  });
  return seats;
}

// ── Seed Data ────────────────────────────────────────────────
async function seedShows() {
  const Show = require('./models/Show');
  const count = await Show.countDocuments();
  if (count === 0) {
    // We need movie IDs — we store placeholder IDs; real IDs added from movie service
    // For seeding, use fixed Mongoose ObjectIds that match actual movie IDs
    const shows = [
      {
        movieId: 'MOVIE_INCEPTION',      // replaced on first use
        movieTitle: 'Inception',
        theatreName: 'PVR Cinemas - Mumbai',
        date: '2026-10-05',
        time: '10:00 AM',
        seats: generateSeats({ A: 300, B: 250, C: 200, D: 150 }),
      },
      {
        movieId: 'MOVIE_INTERSTELLAR',
        movieTitle: 'Interstellar',
        theatreName: 'INOX - Delhi',
        date: '2026-10-05',
        time: '02:00 PM',
        seats: generateSeats({ A: 350, B: 300, C: 250, D: 200 }),
      },
      {
        movieId: 'MOVIE_AVENGERS',
        movieTitle: 'Avengers: Endgame',
        theatreName: 'Cinepolis - Bangalore',
        date: '2026-10-06',
        time: '06:00 PM',
        seats: generateSeats({ A: 400, B: 350, C: 300, D: 250 }),
      },
    ];
    await Show.insertMany(shows);
    console.log('[SHOW/SEAT SERVICE] Seeded 3 sample shows with 20 seats each');
  }
}
