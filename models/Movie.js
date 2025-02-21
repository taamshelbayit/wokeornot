// models/Movie.js
const mongoose = require('mongoose');

const MovieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  tmdbId: { type: String, required: true, unique: true },
  description: String,
  releaseDate: Date,
  posterPath: String,

  ratings: [Number],
  averageRating: { type: Number, default: 0 },
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
  forum: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],

  contentType: { type: String, default: 'Movie' },
  wokeCategoryCounts: {
    type: Map,
    of: Number,
    default: {}
  },

  // NEW: track how many users marked this as "Not Woke"
  notWokeCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('Movie', MovieSchema);
