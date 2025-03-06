// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ensureAuthenticated } = require('../utils/auth');
const userController = require('../controllers/userController');

// GET /users => user directory
router.get('/', ensureAuthenticated, async (req, res) => {
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
    // Exclude self from the search results
    query._id = { $ne: req.user._id };

    const users = await User.find(query).limit(50);
    res.render('users-list', { users, searchQuery: q });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading user list');
    res.redirect('/');
  }
});

// POST /users/follow/:id
router.post('/follow/:id', ensureAuthenticated, userController.followUser);

// POST /users/unfollow/:id
router.post('/unfollow/:id', ensureAuthenticated, userController.unfollowUser);

module.exports = router;
