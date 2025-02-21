// models/Review.js
const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    min: 0, // allow 0 for "Not Woke"
    max: 10,
    required: true
  },
  content: { type: String }, // optional text review
  categories: [{ type: String }], // e.g. "Gay Marriage", "Political", etc.
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', ReviewSchema);
