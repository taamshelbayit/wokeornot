// routes/feed.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const User = require('../models/User');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /feed => shows recent reviews from users you follow
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // get the IDs of people we follow
    await req.user.populate('following');
    const followingIds = req.user.following.map(u => u._id);

    // find reviews by those users
    const reviews = await Review.find({ user: { $in: followingIds } })
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
