// routes/admin.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Review = require('../models/Review');
const User = require('../models/User');
const { ensureAuthenticated, ensureAdmin } = require('../utils/auth');

// GET /admin => flagged comments, all reviews, user list
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const comments = await Comment.find({ flagged: true })
      .populate('user')
      .populate('movie');
    const reviews = await Review.find({})
      .populate('user')
      .populate('movie')
      .sort({ createdAt: -1 })
      .limit(50);
    const users = await User.find({}).sort({ createdAt: -1 }).limit(50);

    res.render('admin', { comments, reviews, users });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading admin panel');
    res.redirect('/');
  }
});

// POST /admin/remove/:commentId => Remove flagged comment
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

// POST /admin/ban/:userId => Ban user
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

// POST /admin/unban/:userId => Unban user
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
