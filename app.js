// app.js
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

// Initialize app
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Body Parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Express Session
app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: true,
  saveUninitialized: true
}));

// Connect Flash
app.use(flash());

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Global Variables for Flash & User Info
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg   = req.flash('error_msg');
  res.locals.error       = req.flash('error');
  res.locals.user        = req.user || null;
  next();
});

// Passport Config
require('./config/passport')(passport);

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/movies', require('./routes/movies'));
app.use('/reviews', require('./routes/reviews'));
app.use('/forum', require('./routes/forum'));
app.use('/admin', require('./routes/admin'));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
