// routes/users.js
const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
const User = require('../models/User');
const Review = require('../models/Review'); // or wherever your Review model is
const Post = require('../models/Post');     // forum posts
const { ensureAuthenticated } = require('../utils/auth');
const userController = require('../controllers/userController');

// GET /users => user directory
router.get('/', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const q = req.query.q || '';
    let query = {};
    if (q.trim() !== '') {
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }
    // Exclude the current user from the list
    query._id = { $ne: req.user._id };

    const users = await User.find(query).limit(50);

    // For each user, fetch stats (reviews count, posts count)
    const userStats = {};
    for (let u of users) {
      const reviewCount = await Review.countDocuments({ user: u._id });
      const postCount = await Post.countDocuments({ author: u._id, parentPost: null }); // only top-level posts
      userStats[u._id] = { reviewCount, postCount };
    }

    // Pass the CSRF token to the view for any forms (like follow/unfollow buttons)
    res.render('users-list', { users, userStats, searchQuery: q, csrfToken: req.csrfToken() });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading user list');
    res.redirect('/');
  }
});

// POST /users/follow/:id
router.post('/follow/:id', ensureAuthenticated, csrfProtection, userController.followUser);

// POST /users/unfollow/:id
router.post('/unfollow/:id', ensureAuthenticated, csrfProtection, userController.unfollowUser);

module.exports = router;
