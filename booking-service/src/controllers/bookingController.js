// ============================================================
// BOOKING CONTROLLER
// Core business logic demonstrating:
//   - SYNCHRONOUS calls to User, Movie, Show services
//   - ASYNCHRONOUS events via RabbitMQ
// ============================================================
const Booking = require('../models/Booking');
const { callService, callServiceWithRetry } = require('../services/httpClient');
const { publishEvent } = require('../rabbitmq/publisher');

const USER_SERVICE_URL  = process.env.USER_SERVICE_URL  || 'http://localhost:8001';
const MOVIE_SERVICE_URL = process.env.MOVIE_SERVICE_URL || 'http://localhost:8002';
const SHOW_SERVICE_URL  = process.env.SHOW_SERVICE_URL  || 'http://localhost:8004';

// ── POST /bookings ─────────────────────────────────────────
// Main booking flow — demonstrates all synchronous calls
exports.createBooking = async (req, res) => {
  const { userId, movieId, showId, seats } = req.body;

  // ── Input validation ─────────────────────────────────────
  if (!userId || !movieId || !showId || !seats || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'userId, movieId, showId, and seats[] are required',
    });
  }

  console.log('\n[BOOKING SERVICE] ════ Creating new booking ════');
  console.log(`[BOOKING SERVICE] User: ${userId} | Movie: ${movieId} | Show: ${showId} | Seats: ${seats}`);

  // ── Step 1: Verify user exists (SYNCHRONOUS call) ────────
  console.log('[BOOKING SERVICE] ➜ Calling User Service...');
  let user;
  try {
    const userRes = await callServiceWithRetry(
      `${USER_SERVICE_URL}/users/${userId}`,
      'GET',
      null,
      'User Service'
    );
    user = userRes.data.user;
    console.log(`[BOOKING SERVICE] ✓ User validated → ${user.name}`);
  } catch (err) {
    console.error('[BOOKING SERVICE] ✗ User Service error:', err.message);
    return res.status(err.status || 502).json({ success: false, message: err.message });
  }

  // ── Step 2: Verify movie exists (SYNCHRONOUS call) ───────
  console.log('[BOOKING SERVICE] ➜ Calling Movie Service...');
  let movie;
  try {
    const movieRes = await callServiceWithRetry(
      `${MOVIE_SERVICE_URL}/movies/${movieId}`,
      'GET',
      null,
      'Movie Service'
    );
    movie = movieRes.data.movie;
    console.log(`[BOOKING SERVICE] ✓ Movie validated → ${movie.title}`);
  } catch (err) {
    console.error('[BOOKING SERVICE] ✗ Movie Service error:', err.message);
    return res.status(err.status || 502).json({ success: false, message: err.message });
  }

  // ── Step 3: Verify show exists (SYNCHRONOUS call) ────────
  console.log('[BOOKING SERVICE] ➜ Calling Show/Seat Service (verify show)...');
  let show;
  try {
    const showRes = await callServiceWithRetry(
      `${SHOW_SERVICE_URL}/shows/${showId}`,
      'GET',
      null,
      'Show/Seat Service'
    );
    show = showRes.data.show;
    console.log(`[BOOKING SERVICE] ✓ Show validated → ${show.theatreName}`);
  } catch (err) {
    console.error('[BOOKING SERVICE] ✗ Show/Seat Service error:', err.message);
    return res.status(err.status || 502).json({ success: false, message: err.message });
  }

  // ── Step 4: Lock seats (SYNCHRONOUS call — seat locking) ─
  console.log(`[BOOKING SERVICE] ➜ Requesting seat lock for: ${seats.join(', ')}`);
  try {
    await callService(
      `${SHOW_SERVICE_URL}/shows/${showId}/lock-seats`,
      'POST',
      { seats, lockedBy: userId },
      'Show/Seat Service (lock)'
    );
    console.log(`[BOOKING SERVICE] ✓ Seats ${seats.join(', ')} locked successfully`);
  } catch (err) {
    console.error('[BOOKING SERVICE] ✗ Seat locking failed:', err.message);
    return res.status(err.status || 409).json({ success: false, message: err.message });
  }

  // ── Step 5: Calculate total amount ───────────────────────
  const seatPrices = {};
  show.seats.forEach((s) => { seatPrices[s.seatNumber] = s.price; });
  const totalAmount = seats.reduce((sum, sn) => sum + (seatPrices[sn] || 0), 0);

  // ── Step 6: Create booking record (PENDING) ───────────────
  let booking;
  try {
    booking = await Booking.create({
      userId,
      movieId,
      showId,
      seats,
      totalAmount,
      status: 'PENDING',
      userName: user.name,
      movieTitle: movie.title,
      theatreName: show.theatreName,
      showDate: show.date,
      showTime: show.time,
    });
    console.log(`[BOOKING SERVICE] Booking record created → ID: ${booking._id} (PENDING)`);
  } catch (err) {
    // Release locks if booking creation fails
    await callService(`${SHOW_SERVICE_URL}/shows/${showId}/release-seats`, 'POST', { seats });
    return res.status(500).json({ success: false, message: 'Failed to create booking: ' + err.message });
  }

  // ── Step 7: Confirm seats (LOCKED → BOOKED) ──────────────
  try {
    await callService(
      `${SHOW_SERVICE_URL}/shows/${showId}/book-seats`,
      'POST',
      { seats },
      'Show/Seat Service (book)'
    );
    console.log(`[BOOKING SERVICE] ✓ Seats confirmed as BOOKED`);
  } catch (err) {
    // Mark booking as failed
    booking.status = 'FAILED';
    await booking.save();
    return res.status(500).json({ success: false, message: 'Failed to confirm seats: ' + err.message });
  }

  // ── Step 8: Confirm booking ───────────────────────────────
  booking.status = 'CONFIRMED';
  await booking.save();
  console.log(`[BOOKING SERVICE] ✓ Booking CONFIRMED → ${booking._id}`);

  // ── Step 9: Publish async event to RabbitMQ ──────────────
  // NOTE: This is ASYNCHRONOUS — we do NOT wait for Notification Service
  const event = {
    event: 'BOOKING_CONFIRMED',
    bookingId: booking._id.toString(),
    userId,
    movieId,
    showId,
    userName: user.name,
    movieTitle: movie.title,
    seats,
    totalAmount,
    createdAt: booking.createdAt,
  };
  publishEvent('booking.confirmed', event);
  console.log('[BOOKING SERVICE] ✓ BOOKING_CONFIRMED event published to RabbitMQ (ASYNC)');
  console.log('[BOOKING SERVICE] ════ Booking flow complete ════\n');

  res.status(201).json({ success: true, booking });
};

// ── GET /bookings ───────────────────────────────────────────
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /bookings/:id ───────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error or invalid ID' });
  }
};

// ── GET /bookings/user/:userId ──────────────────────────────
exports.getBookingsByUser = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /bookings/:id/cancel ───────────────────────────────
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, message: `Cannot cancel booking with status: ${booking.status}` });
    }

    booking.status = 'CANCELLED';
    await booking.save();
    console.log(`[BOOKING SERVICE] Booking ${booking._id} CANCELLED`);

    // Publish cancellation event (ASYNCHRONOUS)
    const event = {
      event: 'BOOKING_CANCELLED',
      bookingId: booking._id.toString(),
      userId: booking.userId,
      movieTitle: booking.movieTitle,
      seats: booking.seats,
      totalAmount: booking.totalAmount,
    };
    publishEvent('booking.cancelled', event);
    console.log('[BOOKING SERVICE] BOOKING_CANCELLED event published to RabbitMQ (ASYNC)');

    res.json({ success: true, message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
