// routes/feed.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { ensureAuthenticated } = require('../utils/auth');

// GET /feed => shows reviews from followed users
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const followedIds = req.user.following; // array of user IDs
    // find reviews where user is in followedIds
    const reviews = await Review.find({ user: { $in: followedIds } })
      .populate('user')   // to display user name, avatar
      .populate('movie')  // to display movie title
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
