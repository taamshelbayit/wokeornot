// routes/admin.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { ensureAuthenticated, ensureAdmin } = require('../utils/auth');

// GET Admin Panel => list flagged comments
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const comments = await Comment.find({ flagged: true })
      .populate('user')
      .populate('movie');
    res.render('admin', { comments });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading admin panel');
    res.redirect('/');
  }
});

// POST Remove (delete) a Comment
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

module.exports = router;
