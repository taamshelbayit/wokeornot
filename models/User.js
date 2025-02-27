// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  verified: { type: Boolean, default: false },
  verifyToken: String,
  verifyExpires: Date,

  role: { type: String, default: 'user' }, // 'user', 'admin', 'banned'

  badges: [{ type: String }], // e.g. '10-reviews', '50-reviews', etc.

  // For social/follow system
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // For watchlists
  watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }],

  // For advanced search saved queries
  savedSearches: [{
    name: String,
    query: String,
    createdAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

// Hash password if changed
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);
