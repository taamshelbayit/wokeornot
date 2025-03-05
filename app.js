// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const bodyParser = require('body-parser');
const ejsMate = require('ejs-mate');
const i18n = require('i18n');
const http = require('http');
const socketIo = require('socket.io');

const app = express();

// 1) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// 2) EJS setup with ejs-mate
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 3) Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Provide defaults for dynamic references in layout (meta tags, etc.)
app.use((req, res, next) => {
  res.locals.pageTitle = 'WokeOrNot';
  res.locals.pageDescription = 'Rate the Wokeness of your favorite shows & movies.';
  res.locals.ogImage = 'https://www.wokeornot.net/images/logo.webp';
  res.locals.ogUrl = 'https://www.wokeornot.net';
  next();
});

// 4) i18n init (internationalization)
i18n.configure({
  locales: ['en'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'en',
  objectNotation: true
});
app.use(i18n.init);

// 5) Body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 6) Express session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: true,
  saveUninitialized: true
}));

// 7) Passport config
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// 8) Connect flash
app.use(flash());

// 9) Global flash vars and user
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg   = req.flash('error_msg');
  res.locals.error       = req.flash('error');
  res.locals.user        = req.user || null;
  next();
});

// 10) Socket.io setup for real-time notifications
const server = http.createServer(app);
const io = socketIo(server);
app.use((req, res, next) => {
  req.io = io;
  next();
});
io.on('connection', socket => {
  console.log('Socket connected');
  socket.on('join', userId => {
    if (userId) {
      socket.join(userId);
    }
  });
});

// 11) Routes
app.use('/', require('./routes/index')); // homepage & main
app.use('/auth', require('./routes/auth')); // login, register, verify
app.use('/movies', require('./routes/movies')); // rating, listing
app.use('/reviews', require('./routes/reviews'));
app.use('/forum', require('./routes/forum'));
app.use('/admin', require('./routes/admin'));
app.use('/search', require('./routes/search'));
app.use('/profile', require('./routes/profile'));
app.use('/feed', require('./routes/feed'));
app.use('/notifications', require('./routes/notifications'));
app.use('/blog', require('./routes/blog'));
app.use('/users', require('./routes/users'));
app.use('/sitemap.xml', require('./routes/sitemap'));

// 12) Sentry error handler (if using Sentry)
// if (process.env.SENTRY_DSN) {
//   app.use(Sentry.Handlers.errorHandler());
// }

// 13) Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
