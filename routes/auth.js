// routes/auth.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const transporter = require('../config/nodemailer'); // nodemailer config
const { ensureAuthenticated } = require('../utils/auth');

// GET /auth/register => show registration form
router.get('/register', (req, res) => {
  res.render('register');
});

// POST /auth/register => create user, check password rules, send verify email
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, password2 } = req.body;

    // 1) Basic field checks
    if (!firstName || !lastName || !email || !password || !password2) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/auth/register');
    }
    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    // 2) Basic password requirements:
    // at least 8 chars, one uppercase, one digit
    const passRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passRegex.test(password)) {
      req.flash(
        'error_msg',
        'Password must be at least 8 chars, include 1 uppercase letter and 1 digit'
      );
      return res.redirect('/auth/register');
    }

    // 3) Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/auth/register');
    }

    // 4) Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      verified: false // not verified yet
    });

    // We'll generate a random verifyToken
    newUser.verifyToken = crypto.randomBytes(20).toString('hex');
    // set expiry (1 day from now)
    newUser.verifyExpires = Date.now() + 24 * 60 * 60 * 1000;

    await newUser.save();

    // 5) Send verification email
    const verifyURL = `http://${req.headers.host}/auth/verify/${newUser.verifyToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: newUser.email,
      subject: 'Verify your WokeOrNot account',
      text: `Hello ${newUser.firstName}, please verify your account by clicking this link: ${verifyURL}`
    };
    await transporter.sendMail(mailOptions);

    req.flash(
      'success_msg',
      'Registration successful! Please check your email to verify your account.'
    );
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error registering user');
    res.redirect('/auth/register');
  }
});

// GET /auth/verify/:token => verify email link
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      verifyToken: req.params.token,
      verifyExpires: { $gt: Date.now() } // not expired
    });
    if (!user) {
      req.flash('error_msg', 'Verification link is invalid or has expired');
      return res.redirect('/auth/login');
    }

    // set verified
    user.verified = true;
    user.verifyToken = undefined;
    user.verifyExpires = undefined;
    await user.save();

    req.flash('success_msg', 'Email verified! You can now log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error verifying email');
    res.redirect('/auth/login');
  }
});

// GET /auth/login => show login form
router.get('/login', (req, res) => {
  res.render('login');
});

// POST /auth/login => authenticate user, block if not verified
router.post('/login', async (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error_msg', info.message || 'Invalid credentials');
      return res.redirect('/auth/login');
    }
    // Check if user is verified
    if (!user.verified) {
      req.flash('error_msg', 'Please verify your email before logging in.');
      return res.redirect('/auth/login');
    }
    // if verified, log them in
    req.logIn(user, (err) => {
      if (err) return next(err);
      req.flash('success_msg', 'You are now logged in');
      res.redirect('/');
    });
  })(req, res, next);
});

// GET /auth/logout => log out user
router.get('/logout', (req, res) => {
  req.logout(() => {
    req.flash('success_msg', 'You are logged out');
    res.redirect('/auth/login');
  });
});

module.exports = router;
