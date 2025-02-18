// routes/profile.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../utils/auth');
const Review = require('../models/Review');
const Comment = require('../models/Comment');

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch user's reviews (populating movie for the title)
    const reviews = await Review.find({ user: userId }).populate('movie');

    // Fetch user's forum comments (also populate movie)
    const comments = await Comment.find({ user: userId }).populate('movie');

    res.render('profile', { reviews, comments });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/');
  }
});

module.exports = router;
