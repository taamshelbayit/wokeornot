// routes/feed.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { ensureAuthenticated } = require('../utils/auth');

// GET /feed => show reviews from followed users
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const followedIds = req.user.following;
    const reviews = await Review.find({ user: { $in: followedIds } })
      .populate('user')
      .populate('movie')
      .sort({ createdAt: -1 })
      .limit(50);

    res.render('feed', { reviews });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading feed');
    res.redirect('/');
  }
});

module.exports = router;
