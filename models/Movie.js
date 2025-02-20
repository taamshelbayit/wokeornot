// models/Movie.js
//const mongoose = require('mongoose');

//const MovieSchema = new mongoose.Schema({
//  title:         { type: String, required: true },
//  tmdbId:        { type: String, required: true },
//  description:   { type: String },
//  releaseDate:   { type: Date },
//  posterPath:    { type: String },
//  ratings:       [{ type: Number }], // individual ratings
//  averageRating: { type: Number, default: 0 },
//  reviews:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
//  forum:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
//});

//module.exports = mongoose.model('Movie', MovieSchema);


// models/Movie.js
const mongoose = require('mongoose');

const MovieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  tmdbId: {
    type: String,
    required: true
  },
  description: String,
  releaseDate: Date,
  posterPath: String,

  // Store the numeric ratings and compute averageRating
  ratings: [Number],
  averageRating: { type: Number, default: 0 },

  // Reviews and forum references
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
  forum: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],

  // NEW: Whether it's a Movie, TV, or Kids
  contentType: {
    type: String,
    enum: ['Movie', 'TV', 'Kids'],
    default: 'Movie'
  },

  // NEW: Track how many times each woke category is chosen
  wokeCategoryCounts: {
    type: Map,
    of: Number,
    default: {}
  }
});

module.exports = mongoose.model('Movie', MovieSchema);
