// ============================================================
// MOVIE SERVICE - server.js
// Port: 8002
// Responsible for movie catalog management
// ============================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const movieRoutes = require('./routes/movieRoutes');

const app = express();
const PORT = process.env.PORT || 8002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticket_movies';

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/movies', movieRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'movie-service', port: PORT });
});

// ── MongoDB connection ───────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('[MOVIE SERVICE] MongoDB connected → ticket_movies');
    await seedMovies();
    app.listen(PORT, () => {
      console.log(`[MOVIE SERVICE] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[MOVIE SERVICE] MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Seed Data ────────────────────────────────────────────────
async function seedMovies() {
  const Movie = require('./models/Movie');
  const count = await Movie.countDocuments();
  if (count === 0) {
    const movies = [
      {
        title: 'Inception',
        genre: 'Sci-Fi / Thriller',
        language: 'English',
        duration: 148,
        description: 'A thief who steals corporate secrets through dream-sharing technology.',
        rating: 8.8,
      },
      {
        title: 'Interstellar',
        genre: 'Sci-Fi / Drama',
        language: 'English',
        duration: 169,
        description: 'A team of explorers travel through a wormhole in space.',
        rating: 8.6,
      },
      {
        title: 'Avengers: Endgame',
        genre: 'Action / Adventure',
        language: 'English',
        duration: 181,
        description: 'The Avengers assemble once more to reverse Thanos\'s actions.',
        rating: 8.4,
      },
      {
        title: 'Dune',
        genre: 'Sci-Fi / Adventure',
        language: 'English',
        duration: 155,
        description: 'A noble family becomes embroiled in a war for a desert planet.',
        rating: 8.0,
      },
      {
        title: 'The Dark Knight',
        genre: 'Action / Crime',
        language: 'English',
        duration: 152,
        description: 'Batman faces the Joker, a criminal mastermind who plunges Gotham into chaos.',
        rating: 9.0,
      },
    ];
    await Movie.insertMany(movies);
    console.log('[MOVIE SERVICE] Seeded 5 sample movies');
  }
}
