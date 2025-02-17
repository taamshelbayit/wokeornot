// routes/auth.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GET Login Page
router.get('/login', (req, res) => res.render('login'));

// GET Register Page
router.get('/register', (req, res) => res.render('register'));

// POST Register Handle
router.post('/register', (req, res) => {
  const { name, email, password, password2 } = req.body;
  let errors = [];

  if(!name || !email || !password || !password2) {
    errors.push({ msg: 'Please fill in all fields' });
  }
  if(password !== password2) {
    errors.push({ msg: 'Passwords do not match' });
  }
  if(password.length < 6) {
    errors.push({ msg: 'Password should be at least 6 characters' });
  }

  if(errors.length > 0) {
    res.render('register', { errors, name, email, password, password2 });
  } else {
    User.findOne({ email: email }).then(user => {
      if(user) {
        errors.push({ msg: 'Email is already registered' });
        res.render('register', { errors, name, email, password, password2 });
      } else {
        const newUser = new User({ name, email, password, role: 'user' });
        // Hash Password
        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(newUser.password, salt, (err, hash) => {
            if(err) throw err;
            newUser.password = hash;
            newUser.save()
              .then(user => {
                req.flash('success_msg', 'You are now registered and can log in');
                res.redirect('/auth/login');
              })
              .catch(err => console.log(err));
          });
        });
      }
    });
  }
});

// POST Login Handle
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/auth/login',
    failureFlash: true
  })(req, res, next);
});

// GET Logout Handle
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if(err) return next(err);
    req.flash('success_msg', 'You are logged out');
    res.redirect('/auth/login');
  });
});

// Google OAuth Routes
//router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
//router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/login', successRedirect: '/' }));

// Facebook OAuth Routes
//router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
//router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/auth/login', successRedirect: '/' }));

module.exports = router;
