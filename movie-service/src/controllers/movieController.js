// ============================================================
// MOVIE CONTROLLER
// ============================================================
const Movie = require('../models/Movie');

// GET /movies — list all movies
exports.getAllMovies = async (req, res) => {
  try {
    const movies = await Movie.find();
    res.json({ success: true, count: movies.length, movies });
  } catch (err) {
    console.error('[MOVIE SERVICE] Error fetching movies:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /movies/:id — get single movie
exports.getMovieById = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    console.log(`[MOVIE SERVICE] Movie ${req.params.id} found → ${movie.title}`);
    res.json({ success: true, movie });
  } catch (err) {
    console.error('[MOVIE SERVICE] Error fetching movie:', err.message);
    res.status(500).json({ success: false, message: 'Server error or invalid ID' });
  }
};

// POST /movies — add a new movie
exports.createMovie = async (req, res) => {
  try {
    const { title, genre, language, duration, description, rating } = req.body;
    if (!title || !genre || !duration) {
      return res.status(400).json({ success: false, message: 'title, genre, and duration are required' });
    }
    const movie = await Movie.create({ title, genre, language, duration, description, rating });
    console.log(`[MOVIE SERVICE] New movie added → ${movie.title}`);
    res.status(201).json({ success: true, movie });
  } catch (err) {
    console.error('[MOVIE SERVICE] Error creating movie:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /movies/:id — update a movie
exports.updateMovie = async (req, res) => {
  try {
    const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    console.log(`[MOVIE SERVICE] Movie updated → ${movie.title}`);
    res.json({ success: true, movie });
  } catch (err) {
    console.error('[MOVIE SERVICE] Error updating movie:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /movies/:id — delete a movie
exports.deleteMovie = async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    console.log(`[MOVIE SERVICE] Movie deleted → ${movie.title}`);
    res.json({ success: true, message: 'Movie deleted successfully' });
  } catch (err) {
    console.error('[MOVIE SERVICE] Error deleting movie:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
