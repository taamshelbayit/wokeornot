// config/passport.js
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = function (passport) {
  // Local Strategy
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        console.log('Local strategy triggered for email:', email);

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          console.log('No user found with that email.');
          return done(null, false, { message: 'No user found' });
        }

        // If user is banned
        if (user.role === 'banned') {
          console.log('User is banned:', user.email);
          return done(null, false, { message: 'User is banned' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          console.log('Password matched for user:', user.email);
          return done(null, user);
        } else {
          console.log('Password incorrect for user:', user.email);
          return done(null, false, { message: 'Password incorrect' });
        }
      } catch (err) {
        console.error('Error in Local Strategy:', err);
        return done(err);
      }
    })
  );

  // Google Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'https://www.wokeornot.net/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('Google Strategy triggered');
          console.log('Google profile:', profile);

          // Check if there's an existing user with this googleId
          let user = await User.findOne({ googleId: profile.id });
          console.log('User by googleId:', user);

          if (user) {
            console.log('Found existing user by googleId:', user.email);
            return done(null, user);
          }

          // If no user found by googleId, check by email
          const emailObj = (profile.emails && profile.emails[0]) ? profile.emails[0] : null;
          if (!emailObj) {
            console.log('No email provided by Google profile.');
            return done(null, false, { message: 'No email from Google' });
          }

          const email = emailObj.value.toLowerCase();
          user = await User.findOne({ email });
          console.log('User by email:', user);

          if (user) {
            // Existing user found by email; update googleId
            console.log('Updating existing user with googleId:', user.email);
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          } else {
            // Create a new user with role "user"
            const newUser = new User({
              googleId: profile.id,
              firstName: profile.name?.givenName || 'NoFirst',
              lastName: profile.name?.familyName || 'NoLast',
              email: email,
              password: '', // not used
              verified: true,
              role: 'user'
            });
            console.log('Creating new Google user:', email);
            const savedUser = await newUser.save();
            console.log('New user saved:', savedUser.email, 'with role:', savedUser.role);
            return done(null, savedUser);
          }
        } catch (err) {
          console.error('Error in Google Strategy:', err);
          return done(err);
        }
      })
    );
  }

  // Serialize / Deserialize
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });
};
