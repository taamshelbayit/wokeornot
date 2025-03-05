// routes/forum.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Movie = require('../models/Movie');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /forum/:movieId - View discussion forum for a movie (comments and replies)
 */
router.get('/:movieId', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.movieId);
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }
    const sort = req.query.sort || 'newest';
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') sortObj = { createdAt: 1 };
    // Fetch top-level comments for the movie
    const comments = await Comment.find({ movie: movie._id, parentComment: null })
      .sort(sortObj)
      .populate('user');
    // Fetch replies for each top-level comment
    for (let c of comments) {
      c.children = await Comment.find({ parentComment: c._id })
        .sort({ createdAt: 1 })
        .populate('user');
    }
    res.render('forum', { movie, comments, sort });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading forum');
    res.redirect('/');
  }
});

/**
 * POST /forum/add/:movieId - Add a new comment (or reply) to a movie's forum
 */
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    const movie = await Movie.findById(req.params.movieId);
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }
    // Create and save the new comment
    const newComment = new Comment({
      movie: movie._id,
      user: req.user._id,
      content,
      parentComment: parentId || null
    });
    await newComment.save();
    req.flash('success_msg', 'Comment added');
    res.redirect(`/forum/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding comment');
    res.redirect('/');
  }
});

/**
 * POST /forum/flag/:commentId - Flag a comment for moderation
 */
router.post('/flag/:commentId', ensureAuthenticated, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId).populate('movie');
    if (!comment) {
      req.flash('error_msg', 'Comment not found.');
      return res.redirect('back');
    }
    // Mark comment as flagged
    comment.flagged = true;
    await comment.save();
    // Notify all admins about the flagged comment
    const admins = await User.find({ role: 'admin' });
    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        message: `Comment flagged by ${req.user.firstName} on "${comment.movie.title}"`,
        link: `/forum/${comment.movie._id}`,
        read: false
      });
      // Emit real-time notification to admin if connected
      req.io.to(admin._id.toString()).emit('notification', {
        message: `A comment on "${comment.movie.title}" was flagged.`
      });
    }
    req.flash('success_msg', 'Comment flagged for review.');
    res.redirect(`/forum/${comment.movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error flagging comment.');
    res.redirect('back');
  }
});

module.exports = router;
