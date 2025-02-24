// routes/notifications.js
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { ensureAuthenticated } = require('../utils/auth');

// GET /notifications => list the user's notifications
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // fetch both read and unread, or just unread if you prefer
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.render('notifications', { notifications });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading notifications');
    res.redirect('/');
  }
});

// POST /notifications/mark-read => mark all as read
router.post('/mark-read', ensureAuthenticated, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );
    req.flash('success_msg', 'All notifications marked as read');
    res.redirect('/notifications');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error marking notifications');
    res.redirect('/notifications');
  }
});

module.exports = router;
