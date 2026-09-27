// ── Booking Routes ────────────────────────────────────────
const express = require('express');
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getBookingById,
  getBookingsByUser,
  cancelBooking,
} = require('../controllers/bookingController');

// IMPORTANT: /user/:userId must come before /:id to avoid route conflicts
router.get('/user/:userId',   getBookingsByUser);
router.get('/:id',            getBookingById);
router.get('/',               getAllBookings);
router.post('/',              createBooking);
router.post('/:id/cancel',    cancelBooking);

module.exports = router;
