// routes/admin.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Review = require('../models/Review');
const User = require('../models/User');
const Movie = require('../models/Movie');
const { ensureAuthenticated, ensureAdmin } = require('../utils/auth');

/**
 * GET /admin
 * - flagged comments
 * - all reviews (limit 50)
 * - user list (limit 50)
 * - basic stats (userCount, reviewCount, movieCount)
 */
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    // 1) flagged comments
    const comments = await Comment.find({ flagged: true })
      .populate('user')
      .populate('movie');

    // 2) reviews
    const reviews = await Review.find({})
      .populate('user')
      .populate('movie')
      .sort({ createdAt: -1 })
      .limit(50);

    // 3) users
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(50);

    // 4) basic stats
    const userCount = await User.countDocuments({});
    const reviewCount = await Review.countDocuments({});
    const movieCount = await Movie.countDocuments({});

    // Render one admin page with all data
    res.render('admin', {
      comments,
      reviews,
      users,
      userCount,
      reviewCount,
      movieCount
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading admin panel');
    res.redirect('/');
  }
});

/**
 * POST /admin/remove/:commentId => remove flagged comment
 */
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

/**
 * POST /admin/ban/:userId => ban user (set role to "banned")
 */
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

/**
 * POST /admin/unban/:userId => unban user (set role back to "user")
 */
router.post('/unban/:userId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin');
    }
    user.role = 'user';
    await user.save();
    req.flash('success_msg', `User ${user.name} unbanned`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unbanning user');
    res.redirect('/admin');
  }
});

module.exports = router;
