// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ensureAuthenticated } = require('../utils/auth');

// GET /users => show a list of all users (except self)
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Optional: search by ?q=
    let q = req.query.q || '';
    let query = {};

    if (q.trim() !== '') {
      // partial match on firstName, lastName, or email
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }

    // Exclude yourself from the list
    query._id = { $ne: req.user._id };

    const users = await User.find(query).limit(50);

    res.render('users-list', { users, searchQuery: q });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading user list');
    res.redirect('/');
  }
});

module.exports = router;
