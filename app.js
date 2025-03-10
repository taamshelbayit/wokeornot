// app.js
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const passport = require('./config/passport');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const routes = require('./routes');

require('dotenv').config();

// Database connection
mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Express session
app.use(session({
  secret: 'secretKey',
  resave: false,
  saveUninitialized: false
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup EJS with layouts
app.use(expressLayouts);
app.set('view engine', 'ejs');

// Serve static files from public folder
app.use(express.static('public'));

// Use routes
app.use('/', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
