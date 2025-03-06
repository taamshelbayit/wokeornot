// models/Post.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // For threaded discussions, parentPost is null for top-level posts.
  parentPost: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  // Array to store replies/comments (which are also Posts)
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Post'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
