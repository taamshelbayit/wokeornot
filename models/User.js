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
    // Only required if googleId is not present
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
  // Verification fields
  verifyToken: {
    type: String
  },
  verifyExpires: {
    type: Date
  },
  // Additional profile fields
  profileImage: {
    type: String
  },
  bio: {
    type: String
  },
  location: {
    type: String
  },
  socialLinks: {
    twitter: { type: String },
    linkedin: { type: String }
  },
  // Following system fields
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Pre-save middleware to hash password if modified and not empty
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('User', UserSchema);
