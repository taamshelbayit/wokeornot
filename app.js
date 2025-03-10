// app.js
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('./config/passport');
const expressLayouts = require('express-ejs-layouts');
const routes = require('./routes');
require('dotenv').config();

// Connect to MongoDB
if (!process.env.DB_URI) {
  console.error('Error: DB_URI is not defined in the environment variables.');
  process.exit(1);
}

mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Express session (Note: MemoryStore is not recommended for production)
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretKey',
  resave: false,
  saveUninitialized: false
}));

// Connect flash middleware for flash messages
app.use(flash());

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Global variables for flash messages and user data
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg   = req.flash('error_msg');
  res.locals.error       = req.flash('error');
  res.locals.user        = req.user || null;
  next();
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup EJS with layouts
app.use(expressLayouts);
app.set('view engine', 'ejs');

// Serve static files from the public folder
app.use(express.static('public'));

// Use routes
app.use('/', routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
