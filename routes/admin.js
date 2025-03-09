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
    // Flagged comments
    const comments = await Comment.find({ flagged: true })
      .populate('user')
      .populate('movie');
    // Recent reviews
    const reviews = await Review.find({})
      .populate('user')
      .populate('movie')
      .sort({ createdAt: -1 })
      .limit(50);
    // Recent users
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(50);

    // Counts
    const userCount = await User.countDocuments({});
    const reviewCount = await Review.countDocuments({});
    const movieCount = await Movie.countDocuments({});

    // Example of daily new users (last 7 days)
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

// POST /admin/remove/:commentId => remove flagged comment
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

// POST /admin/ban/:userId => ban user
router.post('/ban/:userId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin');
    }
    user.role = 'banned';
    await user.save();
    req.flash('success_msg', `User ${user.firstName || user.email} banned`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error banning user');
    res.redirect('/admin');
  }
});

// POST /admin/unban/:userId => unban user
router.post('/unban/:userId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin');
    }
    user.role = 'user';
    await user.save();
    req.flash('success_msg', `User ${user.firstName || user.email} unbanned`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error unbanning user');
    res.redirect('/admin');
  }
});

/*
  NEW ROUTES FOR STEPS 3 & 4
  - GET /admin/check-user?email=someone@gmail.com => checks if user is in DB
  - POST /admin/set-role => forcibly set user role
*/

// GET /admin/check-user?email=someone@gmail.com
router.get('/check-user', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      req.flash('error_msg', 'No email provided');
      return res.redirect('/admin');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      req.flash('error_msg', `No user found with email: ${email}`);
    } else {
      req.flash('success_msg', `Found user: ${user.email} (role: ${user.role})`);
    }
    res.redirect('/admin');
  } catch (err) {
    console.error('Error checking user by email:', err);
    req.flash('error_msg', 'Error checking user');
    res.redirect('/admin');
  }
});

// POST /admin/set-role => forcibly set user's role
router.post('/set-role', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) {
      req.flash('error_msg', 'Please provide both email and role');
      return res.redirect('/admin');
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { role },
      { new: true }
    );

    if (!updatedUser) {
      req.flash('error_msg', 'No user found to update');
    } else {
      req.flash('success_msg', `Updated ${updatedUser.email} to role: ${updatedUser.role}`);
    }
    res.redirect('/admin');
  } catch (err) {
    console.error('Error updating user role:', err);
    req.flash('error_msg', 'Error updating user role');
    res.redirect('/admin');
  }
});

module.exports = router;
