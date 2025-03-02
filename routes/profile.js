// routes/profile.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /profile => show current user's profile
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('following', 'firstName lastName email') // see who they follow
      .populate('followers', 'firstName lastName email'); // if you track followers

    // Fetch user’s reviews
    const reviews = await Review.find({ user: user._id })
      .populate('movie')
      .sort({ createdAt: -1 });

    // Possibly fetch watchlist items
    let watchlistMovies = [];
    if (user.watchlist && user.watchlist.length > 0) {
      watchlistMovies = await Movie.find({ _id: { $in: user.watchlist } });
    }

    // Achievements
    // e.g. 10-reviews, 50-reviews, first Not Woke mark, etc. stored in user.badges

    res.render('profile', {
      profileUser: user,
      reviews,
      watchlistMovies
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/');
  }
});

/**
 * GET /profile/:id => show another user's profile
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const profileUser = await User.findById(req.params.id)
      .populate('following', 'firstName lastName email')
      .populate('followers', 'firstName lastName email');
    if (!profileUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/profile');
    }

    // fetch their reviews
    const reviews = await Review.find({ user: profileUser._id })
      .populate('movie')
      .sort({ createdAt: -1 });

    // watchlist
    let watchlistMovies = [];
    if (profileUser.watchlist && profileUser.watchlist.length > 0) {
      watchlistMovies = await Movie.find({ _id: { $in: profileUser.watchlist } });
    }

    res.render('profile', {
      profileUser,
      reviews,
      watchlistMovies
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading user profile');
    res.redirect('/');
  }
});

/**
 * POST /profile/follow/:id => follow a user
 */
router.post('/follow/:id', ensureAuthenticated, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/profile');
    }

    // Avoid self-follow
    if (targetUser._id.equals(req.user._id)) {
      req.flash('error_msg', 'You cannot follow yourself');
      return res.redirect(`/profile/${targetUser._id}`);
    }

    // Add each other
    if (!req.user.following.includes(targetUser._id)) {
      req.user.following.push(targetUser._id);
      await req.user.save();
    }
    if (!targetUser.followers.includes(req.user._id)) {
      targetUser.followers.push(req.user._id);
      await targetUser.save();
    }

    req.flash('success_msg', `You are now following ${targetUser.firstName}`);
    res.redirect(`/profile/${targetUser._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error following user');
    res.redirect('/profile');
  }
});

/**
 * POST /profile/unfollow/:id => unfollow a user
 */
router.post('/unfollow/:id', ensureAuthenticated, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/profile');
    }

    // Remove from arrays
    req.user.following = req.user.following.filter(
      uid => !uid.equals(targetUser._id)
    );
    await req.user.save();

    targetUser.followers = targetUser.followers.filter(
      uid => !uid.equals(req.user._id)
    );
    await targetUser.save();

    req.flash('success_msg', `You unfollowed ${targetUser.firstName}`);
    res.redirect(`/profile/${targetUser._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unfollowing user');
    res.redirect('/profile');
  }
});

/**
 * POST /profile/watchlist/add => add a movie to watchlist
 */
router.post('/watchlist/add', ensureAuthenticated, async (req, res) => {
  try {
    const { movieId } = req.body;
    if (!req.user.watchlist.includes(movieId)) {
      req.user.watchlist.push(movieId);
      await req.user.save();
    }
    req.flash('success_msg', 'Movie added to watchlist');
    res.redirect(`/movies/${movieId}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding to watchlist');
    res.redirect('/');
  }
});

/**
 * POST /profile/watchlist/remove => remove from watchlist
 */
router.post('/watchlist/remove', ensureAuthenticated, async (req, res) => {
  try {
    const { movieId } = req.body;
    req.user.watchlist = req.user.watchlist.filter(
      m => m.toString() !== movieId
    );
    await req.user.save();
    req.flash('success_msg', 'Movie removed from watchlist');
    res.redirect(`/movies/${movieId}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error removing from watchlist');
    res.redirect('/');
  }
});

module.exports = router;
