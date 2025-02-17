// models/Movie.js
const mongoose = require('mongoose');

const MovieSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  tmdbId:        { type: String, required: true },
  description:   { type: String },
  releaseDate:   { type: Date },
  posterPath:    { type: String },
  ratings:       [{ type: Number }], // individual ratings
  averageRating: { type: Number, default: 0 },
  reviews:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
  forum:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
});

module.exports = mongoose.model('Movie', MovieSchema);
