// ============================================================
// SHOW/SEAT CONTROLLER
// Implements seat locking, releasing, and booking
// AVAILABLE → LOCKED → BOOKED (or AVAILABLE on timeout)
// ============================================================
const Show = require('../models/Show');

// ── GET /shows ─────────────────────────────────────────────
exports.getAllShows = async (req, res) => {
  try {
    const shows = await Show.find();
    res.json({ success: true, count: shows.length, shows });
  } catch (err) {
    console.error('[SHOW/SEAT SERVICE] Error fetching shows:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /shows/:id ──────────────────────────────────────────
exports.getShowById = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });

    // Release any expired locks before returning
    const released = show.releaseExpiredLocks();
    if (released > 0) {
      await show.save();
      console.log(`[SHOW/SEAT SERVICE] Released ${released} expired locks for show ${show._id}`);
    }

    console.log(`[SHOW/SEAT SERVICE] Show ${req.params.id} fetched → ${show.theatreName}`);
    res.json({ success: true, show });
  } catch (err) {
    console.error('[SHOW/SEAT SERVICE] Error fetching show:', err.message);
    res.status(500).json({ success: false, message: 'Server error or invalid ID' });
  }
};

// ── GET /shows/:id/seats ────────────────────────────────────
exports.getShowSeats = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });

    // Release expired locks
    const released = show.releaseExpiredLocks();
    if (released > 0) await show.save();

    const available = show.seats.filter((s) => s.status === 'AVAILABLE');
    console.log(`[SHOW/SEAT SERVICE] Seats for show ${req.params.id}: ${available.length} available`);
    res.json({ success: true, seats: show.seats });
  } catch (err) {
    console.error('[SHOW/SEAT SERVICE] Error fetching seats:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /shows ─────────────────────────────────────────────
exports.createShow = async (req, res) => {
  try {
    const { movieId, movieTitle, theatreName, date, time, seats } = req.body;
    if (!movieId || !theatreName || !date || !time) {
      return res.status(400).json({ success: false, message: 'movieId, theatreName, date, time are required' });
    }

    // Default seat grid if not provided
    const seatData = seats || generateSeats();
    const show = await Show.create({ movieId, movieTitle, theatreName, date, time, seats: seatData });
    console.log(`[SHOW/SEAT SERVICE] New show created → ${theatreName} at ${time}`);
    res.status(201).json({ success: true, show });
  } catch (err) {
    console.error('[SHOW/SEAT SERVICE] Error creating show:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /shows/:id/lock-seats ──────────────────────────────
// Called by Booking Service synchronously to reserve seats
exports.lockSeats = async (req, res) => {
  try {
    const { seats, lockedBy } = req.body; // seats: ['A1', 'A2']

    if (!seats || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ success: false, message: 'seats array is required' });
    }

    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });

    // Release expired locks first
    show.releaseExpiredLocks();

    // Validate all requested seats are AVAILABLE
    const unavailable = [];
    for (const seatNum of seats) {
      const seat = show.seats.find((s) => s.seatNumber === seatNum);
      if (!seat) {
        unavailable.push(`${seatNum} (not found)`);
      } else if (seat.status !== 'AVAILABLE') {
        unavailable.push(`${seatNum} (${seat.status})`);
      }
    }

    if (unavailable.length > 0) {
      console.log(`[SHOW/SEAT SERVICE] Seat lock REJECTED — seats not available: ${unavailable.join(', ')}`);
      return res.status(409).json({
        success: false,
        message: `Seats not available: ${unavailable.join(', ')}`,
      });
    }

    // Lock the seats
    const lockedAt = new Date();
    show.seats.forEach((seat) => {
      if (seats.includes(seat.seatNumber)) {
        seat.status = 'LOCKED';
        seat.lockedAt = lockedAt;
        seat.lockedBy = lockedBy || 'booking-service';
      }
    });

    await show.save();
    console.log(`[SHOW/SEAT SERVICE] Seats ${seats.join(', ')} LOCKED for show ${req.params.id}`);
    res.json({ success: true, message: `Seats ${seats.join(', ')} locked successfully`, lockedAt });
  } catch (err) {
    console.error('[SHOW/SEAT SERVICE] Error locking seats:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /shows/:id/release-seats ──────────────────────────
// Called to release locked seats (e.g., booking failed)
exports.releaseSeats = async (req, res) => {
  try {
    const { seats } = req.body;

    if (!seats || !Array.isArray(seats)) {
      return res.status(400).json({ success: false, message: 'seats array is required' });
    }

    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });

    show.seats.forEach((seat) => {
      if (seats.includes(seat.seatNumber) && seat.status === 'LOCKED') {
        seat.status = 'AVAILABLE';
        seat.lockedAt = null;
        seat.lockedBy = null;
      }
    });

    await show.save();
    console.log(`[SHOW/SEAT SERVICE] Seats ${seats.join(', ')} RELEASED for show ${req.params.id}`);
    res.json({ success: true, message: `Seats ${seats.join(', ')} released` });
  } catch (err) {
    console.error('[SHOW/SEAT SERVICE] Error releasing seats:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /shows/:id/book-seats ──────────────────────────────
// Called by Booking Service to confirm locked → booked
exports.bookSeats = async (req, res) => {
  try {
    const { seats } = req.body;

    if (!seats || !Array.isArray(seats)) {
      return res.status(400).json({ success: false, message: 'seats array is required' });
    }

    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });

    let totalAmount = 0;
    show.seats.forEach((seat) => {
      if (seats.includes(seat.seatNumber)) {
        if (seat.status === 'LOCKED') {
          seat.status = 'BOOKED';
          seat.lockedAt = null;
          totalAmount += seat.price;
        }
      }
    });

    await show.save();
    console.log(`[SHOW/SEAT SERVICE] Seats ${seats.join(', ')} BOOKED for show ${req.params.id}`);
    res.json({ success: true, message: `Seats ${seats.join(', ')} booked`, totalAmount });
  } catch (err) {
    console.error('[SHOW/SEAT SERVICE] Error booking seats:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Helper ────────────────────────────────────────────────────
function generateSeats() {
  const rows = ['A', 'B', 'C', 'D'];
  const cols = [1, 2, 3, 4, 5];
  const seats = [];
  const priceMap = { A: 300, B: 250, C: 200, D: 150 };
  rows.forEach((row) => {
    cols.forEach((col) => {
      seats.push({ seatNumber: `${row}${col}`, status: 'AVAILABLE', price: priceMap[row] });
    });
  });
  return seats;
}
