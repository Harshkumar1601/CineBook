// ============================================================
// USER SERVICE - server.js
// Port: 8001
// Responsible for user registration and management
// ============================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 8001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticket_users';

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/users', userRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service', port: PORT });
});

// ── MongoDB connection ───────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('[USER SERVICE] MongoDB connected → ticket_users');
    // Seed default users if collection is empty
    await seedUsers();
    app.listen(PORT, () => {
      console.log(`[USER SERVICE] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[USER SERVICE] MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Seed Data ────────────────────────────────────────────────
async function seedUsers() {
  const User = require('./models/User');
  const count = await User.countDocuments();
  if (count === 0) {
    const bcrypt = require('bcryptjs');
    const users = [
      { name: 'Alice Johnson', email: 'alice@example.com', password: await bcrypt.hash('password123', 10) },
      { name: 'Bob Smith',     email: 'bob@example.com',   password: await bcrypt.hash('password123', 10) },
      { name: 'Charlie Brown', email: 'charlie@example.com', password: await bcrypt.hash('password123', 10) },
    ];
    await User.insertMany(users);
    console.log('[USER SERVICE] Seeded 3 default users');
  }
}
