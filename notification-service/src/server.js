// ============================================================
// NOTIFICATION SERVICE - server.js
// Port: 8005
// Listens to RabbitMQ events and generates notifications
// ASYNCHRONOUS consumer — does NOT expose booking endpoints
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startConsumer } = require('./rabbitmq/consumer');

const app = express();
const PORT = process.env.PORT || 8005;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── In-memory notification log (for frontend display) ────────
const notifications = [];

// Export so consumer can push to it
module.exports.notifications = notifications;

// ── REST endpoint: get all notifications ────────────────────
app.get('/notifications', (req, res) => {
  res.json({ success: true, notifications: notifications.slice().reverse() });
});

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', port: PORT });
});

// ── Start HTTP server ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[NOTIFICATION SERVICE] Running on http://localhost:${PORT}`);
  // Start consuming RabbitMQ messages
  startConsumer(notifications);
});
