// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName: { type: String },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: { type: String, required: true },

  // Email verification
  verified: { type: Boolean, default: false },
  verifyToken: { type: String },
  verifyExpires: { type: Date },

  // For roles (e.g., admin, user)
  role: { type: String, default: 'user' },

  // For badges, if you have them
  badges: [{ type: String }],

  createdAt: { type: Date, default: Date.now }
});

// Pre-save hook to hash password if changed
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);
