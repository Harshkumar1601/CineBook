// ── Show/Seat Routes ──────────────────────────────────────
const express = require('express');
const router = express.Router();
const {
  getAllShows,
  getShowById,
  getShowSeats,
  createShow,
  lockSeats,
  releaseSeats,
  bookSeats,
} = require('../controllers/showController');

router.get('/',                     getAllShows);
router.get('/:id',                  getShowById);
router.get('/:id/seats',            getShowSeats);
router.post('/',                    createShow);
router.post('/:id/lock-seats',      lockSeats);
router.post('/:id/release-seats',   releaseSeats);
router.post('/:id/book-seats',      bookSeats);

module.exports = router;
