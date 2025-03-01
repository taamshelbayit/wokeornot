// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ensureAuthenticated } = require('../utils/auth');

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
    // exclude self
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
router.post('/follow/:id', ensureAuthenticated, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      req.flash('error_msg', 'Cannot follow yourself');
      return res.redirect('/users');
    }
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users');
    }
    if (!req.user.following.includes(targetUser._id)) {
      req.user.following.push(targetUser._id);
      await req.user.save();
    }
    if (!targetUser.followers.includes(req.user._id)) {
      targetUser.followers.push(req.user._id);
      await targetUser.save();
    }
    req.flash('success_msg', `You are now following ${targetUser.firstName}`);
    res.redirect('/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error following user');
    res.redirect('/users');
  }
});

// POST /users/unfollow/:id
router.post('/unfollow/:id', ensureAuthenticated, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users');
    }
    req.user.following = req.user.following.filter(u => !u.equals(targetUser._id));
    await req.user.save();

    targetUser.followers = targetUser.followers.filter(u => !u.equals(req.user._id));
    await targetUser.save();

    req.flash('success_msg', `You have unfollowed ${targetUser.firstName}`);
    res.redirect('/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unfollowing user');
    res.redirect('/users');
  }
});

module.exports = router;
