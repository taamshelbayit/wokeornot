// config/passport.js
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load User model
const User = require('../models/User');

module.exports = function(passport) {
  // Local Strategy
  passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    User.findOne({ email: email })
      .then(user => {
        if (!user) {
          return done(null, false, { message: 'No user found' });
        }
        // Match password
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) throw err;
          isMatch ? done(null, user) : done(null, false, { message: 'Password incorrect' });
        });
      })
      .catch(err => console.log(err));
  }));

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    User.findOne({ googleId: profile.id })
      .then(user => {
        if(user) {
          return done(null, user);
        } else {
          const newUser = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            role: 'user'
          });
          newUser.save().then(user => done(null, user)).catch(err => console.log(err));
        }
      });
  }));

  // Facebook OAuth Strategy
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'emails']
  },
  (accessToken, refreshToken, profile, done) => {
    User.findOne({ facebookId: profile.id })
      .then(user => {
        if(user) {
          return done(null, user);
        } else {
          const newUser = new User({
            facebookId: profile.id,
            name: profile.displayName,
            email: profile.emails ? profile.emails[0].value : '',
            role: 'user'
          });
          newUser.save().then(user => done(null, user)).catch(err => console.log(err));
        }
      });
  }));

  // Serialize & Deserialize
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });
};
