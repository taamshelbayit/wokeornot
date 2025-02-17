// models/Review.js
const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  movie:      { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:     { type: Number, min: 1, max: 10, required: true },
  content:    { type: String, required: true },
  categories: [{ type: String }], // e.g., Transgender Themes, LGBT Representation, Race Swapping, Feminist Agenda, etc.
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', ReviewSchema);
