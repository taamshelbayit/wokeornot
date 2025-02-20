// routes/admin.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Review = require('../models/Review');
const User = require('../models/User');
const { ensureAuthenticated, ensureAdmin } = require('../utils/auth');

// GET Admin Panel => flagged comments
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const comments = await Comment.find({ flagged: true })
      .populate('user')
      .populate('movie');

    // Also fetch all reviews
    const reviews = await Review.find({})
      .populate('user')
      .populate('movie')
      .limit(50)
      .sort({ createdAt: -1 });

    // Also fetch all users
    const users = await User.find({}).sort({ createdAt: -1 }).limit(50);

    res.render('admin', { comments, reviews, users });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading admin panel');
    res.redirect('/');
  }
});

// POST Remove Comment
router.post('/remove/:commentId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.commentId);
    req.flash('success_msg', 'Comment removed');
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error removing comment');
    res.redirect('/admin');
  }
});

// POST Ban User
router.post('/ban/:userId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin');
    }
    user.role = 'banned';
    await user.save();
    req.flash('success_msg', `User ${user.name} banned`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error banning user');
    res.redirect('/admin');
  }
});

// POST Unban User
router.post('/unban/:userId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin');
    }
    user.role = 'user'; // or 'admin', if you want
    await user.save();
    req.flash('success_msg', `User ${user.name} unbanned`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unbanning user');
    res.redirect('/admin');
  }
});

// GET Monetization Settings (placeholder)
router.get('/monetization', ensureAuthenticated, ensureAdmin, async (req, res) => {
  // You could store monetization settings in your DB
  // For now, just render a placeholder
  res.render('admin_monetization');
});

// POST Monetization Save (placeholder)
router.post('/monetization', ensureAuthenticated, ensureAdmin, async (req, res) => {
  // Save monetization config to DB if you want
  req.flash('success_msg', 'Monetization settings updated');
  res.redirect('/admin/monetization');
});

module.exports = router;
