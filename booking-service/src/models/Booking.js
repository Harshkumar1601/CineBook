// ============================================================
// BOOKING MODEL
// ============================================================
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    // Reference IDs (cross-service — stored as strings)
    userId:    { type: String, required: true },
    movieId:   { type: String, required: true },
    showId:    { type: String, required: true },

    // Snapshot data (denormalized for reliability)
    userName:  { type: String, default: '' },
    movieTitle:{ type: String, default: '' },
    theatreName:{ type: String, default: '' },
    showDate:  { type: String, default: '' },
    showTime:  { type: String, default: '' },

    seats: [{ type: String }],  // e.g. ['A1', 'A2']
    totalAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
