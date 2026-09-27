// ============================================================
// SHOW MODEL
// Includes seat management with AVAILABLE / LOCKED / BOOKED
// Implements lock expiration (LOCKED → AVAILABLE after 2 min)
// ============================================================
const mongoose = require('mongoose');

// ── Seat sub-schema ──────────────────────────────────────────
const seatSchema = new mongoose.Schema(
  {
    seatNumber: { type: String, required: true },   // e.g. A1, B3
    status: {
      type: String,
      enum: ['AVAILABLE', 'LOCKED', 'BOOKED'],
      default: 'AVAILABLE',
    },
    price: { type: Number, required: true },
    lockedAt: { type: Date, default: null },         // when was it locked
    lockedBy: { type: String, default: null },       // optional: who locked it
  },
  { _id: false }
);

// ── Show schema ──────────────────────────────────────────────
const showSchema = new mongoose.Schema(
  {
    movieId: { type: String, required: true },
    movieTitle: { type: String, default: '' },
    theatreName: { type: String, required: true },
    date: { type: String, required: true },          // YYYY-MM-DD
    time: { type: String, required: true },          // e.g. 10:00 AM
    seats: [seatSchema],
  },
  { timestamps: true }
);

// ── Instance method: release expired locks (> 2 minutes) ────
showSchema.methods.releaseExpiredLocks = function () {
  const TWO_MINUTES = 2 * 60 * 1000;
  const now = Date.now();
  let released = 0;
  this.seats.forEach((seat) => {
    if (
      seat.status === 'LOCKED' &&
      seat.lockedAt &&
      now - new Date(seat.lockedAt).getTime() > TWO_MINUTES
    ) {
      seat.status = 'AVAILABLE';
      seat.lockedAt = null;
      seat.lockedBy = null;
      released++;
    }
  });
  return released;
};

module.exports = mongoose.model('Show', showSchema);
