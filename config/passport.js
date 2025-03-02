// config/passport.js
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = function(passport) {
  // Local strategy
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return done(null, false, { message: 'No user found' });
        }
        // If user is banned
        if (user.role === 'banned') {
          return done(null, false, { message: 'User is banned' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Password incorrect' });
        }
      } catch (err) {
        return done(err);
      }
    })
  );

  // Google strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'https://www.wokeornot.net/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            return done(null, user);
          }
          // or check by email
          const email = (profile.emails && profile.emails[0]) ? profile.emails[0].value : null;
          if (!email) {
            return done(null, false, { message: 'No email from Google' });
          }
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          } else {
            // create new user
            const newUser = new User({
              googleId: profile.id,
              firstName: profile.name.givenName || 'NoFirst',
              lastName: profile.name.familyName || 'NoLast',
              email: email,
              password: '', // not used
              verified: true
            });
            await newUser.save();
            return done(null, newUser);
          }
        } catch (err) {
          return done(err);
        }
      })
    );
  }

  // serialize/deserialize
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });
};
