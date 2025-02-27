// models/Comment.js
const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  flagged: { type: Boolean, default: false },

  // For threaded comments
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }
});

module.exports = mongoose.model('Comment', CommentSchema);
