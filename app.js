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
const i18n = require('i18n');        // from your code
const Sentry = require('@sentry/node');  // from our example (optional)
const apicache = require('apicache');    // for caching (optional)
const cache = apicache.middleware;

const app = express();

// 1) (Optional) Sentry init
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  app.use(Sentry.Handlers.requestHandler());
}

// 2) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// 3) EJS setup with ejs-mate
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 4) Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  // Provide defaults for all dynamic references in the layout
  res.locals.pageTitle = 'WokeOrNot';
  res.locals.pageDescription = 'Rate the Wokeness of your favorite shows & movies.';
  res.locals.ogImage = 'https://www.wokeornot.net/images/logo.webp';
  res.locals.ogUrl = 'https://www.wokeornot.net';
  next();
});
// 5) i18n init
i18n.configure({
  locales: ['en'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'en',
  objectNotation: true
});
app.use(i18n.init);

// 6) Body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 7) Express session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: true,
  saveUninitialized: true
}));

// 8) Passport config
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// 9) Connect flash
app.use(flash());

// 10) Global vars
app.use((req, res, next) => {
  // if you want arrays:
  // res.locals.success_msg = req.flash('success_msg') || [];
  // ...
  // or your existing single-value approach:
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg   = req.flash('error_msg');
  res.locals.error       = req.flash('error');
  res.locals.user        = req.user || null;
  next();
});

// 11) Routes
// If you want to use apicache on certain routes, you can do:
//   app.use('/someRoute', cache('15 minutes'), someRouteHandler);

app.use('/', require('./routes/index'));         // homepage
app.use('/auth', require('./routes/auth'));
app.use('/movies', require('./routes/movies'));
app.use('/reviews', require('./routes/reviews'));
app.use('/forum', require('./routes/forum'));
app.use('/admin', require('./routes/admin'));
app.use('/search', require('./routes/search'));
app.use('/profile', require('./routes/profile'));
app.use('/feed', require('./routes/feed'));
app.use('/notifications', require('./routes/notifications'));
app.use('/blog', require('./routes/blog'));      // new blog route
app.use('/users', require('./routes/users'));

// Example for sitemap (we use /sitemap.xml)
app.use('/sitemap.xml', require('./routes/sitemap'));

// 12) Sentry error handler if DSN is set
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// 13) Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
