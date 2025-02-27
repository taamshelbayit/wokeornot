// routes/admin.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Review = require('../models/Review');
const User = require('../models/User');
const Movie = require('../models/Movie');
const { ensureAuthenticated, ensureAdmin } = require('../utils/auth');
const mongoose = require('mongoose');

// GET /admin => flagged comments, all reviews, user list, daily stats
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const comments = await Comment.find({ flagged: true })
      .populate('user')
      .populate('movie');
    const reviews = await Review.find({})
      .populate('user')
      .populate('movie')
      .sort({ createdAt: -1 })
      .limit(50);
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(50);

    const userCount = await User.countDocuments({});
    const reviewCount = await Review.countDocuments({});
    const movieCount = await Movie.countDocuments({});

    // Example of daily new users (last 7 days)
    // Aggregation approach
    const dailyUsers = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Example of daily new reviews
    const dailyReviews = await Review.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.render('admin', {
      comments,
      reviews,
      users,
      userCount,
      reviewCount,
      movieCount,
      dailyUsers,
      dailyReviews
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading admin panel');
    res.redirect('/');
  }
});

// Remove flagged comment
router.post('/remove/:commentId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.commentId);
    req.flash('success_msg', 'Comment removed');
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error removing comment');
    res.redirect('/admin');
  }
});

// Ban user
router.post('/ban/:userId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin');
    }
    user.role = 'banned';
    await user.save();
    req.flash('success_msg', `User ${user.firstName} banned`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error banning user');
    res.redirect('/admin');
  }
});

// Unban user
router.post('/unban/:userId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin');
    }
    user.role = 'user';
    await user.save();
    req.flash('success_msg', `User ${user.firstName} unbanned`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unbanning user');
    res.redirect('/admin');
  }
});

module.exports = router;
