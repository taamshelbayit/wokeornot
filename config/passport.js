const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Local Strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return done(null, false, { message: 'No user found with that email.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) return done(null, user);
    return done(null, false, { message: 'Password incorrect.' });
  } catch (err) {
    return done(err);
  }
}));

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID, // set in your environment
  clientSecret: process.env.GOOGLE_CLIENT_SECRET, // set in your environment
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Try to find an existing user with the googleId
    let user = await User.findOne({ googleId: profile.id });
    if (user) {
      return done(null, user);
    } else {
      // If no user found, create a new user with role set to "user"
      const newUser = new User({
        googleId: profile.id,
        firstName: profile.name.givenName || profile.displayName.split(' ')[0],
        lastName: profile.name.familyName || profile.displayName.split(' ').slice(1).join(' '),
        email: profile.emails[0].value.toLowerCase(),
        role: 'user',  // explicitly set to "user"
        verified: true
      });
      user = await newUser.save();
      return done(null, user);
    }
  } catch (err) {
    return done(err);
  }
}));

// Serialize and deserialize user for session support
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
