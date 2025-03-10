const express = require('express');
const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./config/passport');  // Import passport from our config
const routes = require('./routes');
require('dotenv').config();

// Database connection
mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Express session (Note: MemoryStore is not recommended for production)
app.use(session({
  secret: 'secretKey',
  resave: false,
  saveUninitialized: false
}));

// Passport middleware – these should now work since our config file exports the correct object.
app.use(passport.initialize());
app.use(passport.session());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine, static files, routes, etc.
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
