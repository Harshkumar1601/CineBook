// ============================================================
// MOVIE MODEL
// ============================================================
const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    genre: {
      type: String,
      required: [true, 'Genre is required'],
    },
    language: {
      type: String,
      default: 'English',
    },
    duration: {
      type: Number, // in minutes
      required: [true, 'Duration is required'],
    },
    description: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Movie', movieSchema);
