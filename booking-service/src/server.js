// ============================================================
// BOOKING SERVICE - server.js
// Port: 8003
// Core business service - handles bookings
// Demonstrates SYNCHRONOUS communication with other services
// Demonstrates ASYNCHRONOUS communication via RabbitMQ
// ============================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bookingRoutes = require('./routes/bookingRoutes');
const { connectRabbitMQ } = require('./rabbitmq/publisher');

const app = express();
const PORT = process.env.PORT || 8003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticket_bookings';

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/bookings', bookingRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'booking-service', port: PORT });
});

// ── Start server ─────────────────────────────────────────────
async function startServer() {
  try {
    // Connect MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('[BOOKING SERVICE] MongoDB connected → ticket_bookings');

    // Connect RabbitMQ (non-blocking — retry logic is inside)
    connectRabbitMQ();

    app.listen(PORT, () => {
      console.log(`[BOOKING SERVICE] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[BOOKING SERVICE] Startup error:', err.message);
    process.exit(1);
  }
}

startServer();
