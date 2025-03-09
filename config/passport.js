// config/passport.js
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const path = require('path');

// Use absolute path resolution to ensure we load the correct file from the models directory.
const modelPath = path.resolve(__dirname, '..', 'models', 'User.js');
const User = require(modelPath);

// Debug: Log the absolute path and the User model details to ensure it's the Mongoose model.
console.log('User model loaded from:', modelPath);
console.log('User model in passport.js:', User);
console.log('Type of User.findOne:', typeof User.findOne);

module.exports = function(passport) {
  // 1) Local Strategy
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        console.log('Local Strategy triggered for email:', email);

        // Convert email to lowercase for consistent lookups
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          console.log('No user found with that email.');
          return done(null, false, { message: 'No user found' });
        }

        // If user is not verified
        if (!user.verified) {
          console.log('User not verified:', user.email);
          return done(null, false, { message: 'Please verify your email before logging in.' });
        }

        // If user is banned
        if (user.role === 'banned') {
          console.log('User is banned:', user.email);
          return done(null, false, { message: 'User is banned' });
        }

        // Compare passwords
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

  // 2) Google Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: 'https://www.wokeornot.net/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            console.log('Google Strategy triggered');
            console.log('Google profile:', profile);

            // Ensure User.findOne is available
            if (typeof User.findOne !== 'function') {
              throw new Error('User.findOne is not a function. Check your User model export.');
            }

            // 1) Try to find user by googleId
            let userByGoogleId = await User.findOne({ googleId: profile.id });
            console.log('User by googleId:', userByGoogleId);

            if (userByGoogleId) {
              console.log(`Found existing user by googleId: ${userByGoogleId.email}`);
              return done(null, userByGoogleId);
            }

            // 2) If no user found by googleId, check by email
            const emailObj = profile.emails && profile.emails[0] ? profile.emails[0] : null;
            if (!emailObj) {
              console.log('No email provided by Google profile.');
              return done(null, false, { message: 'No email from Google' });
            }

            const googleEmail = emailObj.value.toLowerCase();
            let userByEmail = await User.findOne({ email: googleEmail });
            console.log('User by email:', userByEmail);

            if (userByEmail) {
              // If found by email, update googleId
              console.log(`Updating existing user with googleId, email = ${googleEmail}`);
              userByEmail.googleId = profile.id;
              await userByEmail.save();
              return done(null, userByEmail);
            }

            // 3) If neither googleId nor email found, create new user
            console.log('No user found by googleId or email. Creating new user.');
            const newUser = new User({
              googleId: profile.id,
              firstName: profile.name?.givenName || 'NoFirst',
              lastName: profile.name?.familyName || 'NoLast',
              email: googleEmail,
              password: '', // not used for Google
              verified: true, // Google users are automatically verified
              role: 'user'
            });
            const savedUser = await newUser.save();
            console.log('New user saved:', savedUser.email, 'role:', savedUser.role);
            return done(null, savedUser);

          } catch (err) {
            console.error('Error in Google Strategy:', err);
            return done(err);
          }
        }
      )
    );
  }

  // 3) Serialize & Deserialize
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  });
};
