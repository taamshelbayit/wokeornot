// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  googleId: {
    type: String
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    // only required if googleId is not present
    required: function() {
      return !this.googleId;
    }
  },
  role: {
    type: String,
    default: 'user'
  },
  verified: {
    type: Boolean,
    default: false
  },
  // Add verification fields:
  verifyToken: {
    type: String
  },
  verifyExpires: {
    type: Date
  },
  // Add a comma after the previous field
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  // etc. (badges, watchers, etc.)
}, { timestamps: true });

// If password is modified and not empty, hash it
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('User', UserSchema);
