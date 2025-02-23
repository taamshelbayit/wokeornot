// routes/profile.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const { ensureAuthenticated } = require('../utils/auth');

// GET /profile => the logged-in user's profile
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch the user's reviews
    const reviews = await Review.find({ user: userId })
      .populate('movie')
      .sort({ createdAt: -1 })
      .limit(50);

    // Populate who the user follows
    await req.user.populate('following');

    res.render('profile', {
      profileUser: req.user, // The logged in user
      reviews,
      isOwnProfile: true
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/');
  }
});

// GET /profile/:userId => view another user's profile
router.get('/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/profile');
    }

    const reviews = await Review.find({ user: user._id })
      .populate('movie')
      .sort({ createdAt: -1 })
      .limit(50);

    // Check if the logged-in user is already following this user
    const isFollowing = req.user.following.some(f => f.equals(user._id));

    res.render('profile', {
      profileUser: user,
      reviews,
      isOwnProfile: false,
      isFollowing
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading user profile');
    res.redirect('/profile');
  }
});

// POST /profile/follow/:userId => follow a user
router.post('/follow/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const toFollow = await User.findById(req.params.userId);
    if (!toFollow) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/profile');
    }
    // Add to the current user's "following" array if not already
    if (!req.user.following.includes(toFollow._id)) {
      req.user.following.push(toFollow._id);
      await req.user.save();
    }
    req.flash('success_msg', `You are now following ${toFollow.name}`);
    res.redirect(`/profile/${toFollow._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error following user');
    res.redirect('/profile');
  }
});

// POST /profile/unfollow/:userId => unfollow user
router.post('/unfollow/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const toUnfollow = await User.findById(req.params.userId);
    if (!toUnfollow) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/profile');
    }
    // Remove from "following"
    req.user.following = req.user.following.filter(f => !f.equals(toUnfollow._id));
    await req.user.save();

    req.flash('success_msg', `You unfollowed ${toUnfollow.name}`);
    res.redirect(`/profile/${toUnfollow._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unfollowing user');
    res.redirect('/profile');
  }
});

module.exports = router;
