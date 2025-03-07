// models/Post.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  title: { type: String },
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  parentPost: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
  comments: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
  // You can add fields like 'upvotes', 'downvotes', or 'timestamp' if needed
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
