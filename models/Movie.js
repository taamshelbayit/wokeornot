// models/Movie.js
const mongoose = require('mongoose');

const MovieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  tmdbId: { type: String, required: true, unique: true },
  description: { type: String },
  releaseDate: { type: Date },
  posterPath: { type: String },

  // rating & review references
  ratings: [Number],
  averageRating: { type: Number, default: 0 },
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
  forum: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],

  // "Movie", "TV", or "Kids"
  contentType: { type: String, default: 'Movie' },

  // Each category => how many times it was chosen
  wokeCategoryCounts: {
    type: Map,
    of: Number,
    default: {}
  }
});

module.exports = mongoose.model('Movie', MovieSchema);
