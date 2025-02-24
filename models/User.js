// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now },
  badges: [{ type: String }], // e.g. ["10-reviews", "top-woke-rater"]


  // Social feature: which users this user follows
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Optional: user avatar, bio, etc.
  avatar: { type: String }, // e.g. URL or local path
  bio: { type: String }
});

// Password hashing if needed
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);
