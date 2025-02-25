// routes/auth.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const Notification = require('../models/Notification'); // for creating notifications
const { ensureAuthenticated } = require('../utils/auth');

// GET /auth/register => show registration form
router.get('/register', (req, res) => {
  res.render('register');
});

// POST /auth/register => create a new user + notify admins
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, password2 } = req.body;

    // Basic validation example
    if (!name || !email || !password || !password2) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/auth/register');
    }
    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/auth/register');
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password
    });
    // If you have password hashing in your User model, it will handle it
    await newUser.save();

    // Notify admins that a new user registered
    const admins = await User.find({ role: 'admin' });
    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        message: `New user registered: ${newUser.name}`,
        link: `/profile/${newUser._id}`, // or wherever you view user profiles
        read: false
      });
    }

    req.flash('success_msg', 'You are now registered! Please log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error registering user');
    res.redirect('/auth/register');
  }
});

// GET /auth/login => show login form
router.get('/login', (req, res) => {
  res.render('login');
});

// POST /auth/login => authenticate user
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/auth/login',
    failureFlash: true
  })(req, res, next);
});

// GET /auth/logout => log out user
router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success_msg', 'You are logged out');
  res.redirect('/auth/login');
});

module.exports = router;
