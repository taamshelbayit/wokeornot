// routes/forum.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /forum/:movieId => show discussion for a specific movie
 * with threaded comments (parentComment -> children).
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

    const comments = await Comment.find({ movie: movie._id, parentComment: null })
      .sort(sortObj)
      .populate('user');

    // naive approach: fetch children
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
 * POST /forum/add/:movieId => add a new comment
 */
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    const movie = await Movie.findById(req.params.movieId);
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

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
 * POST /forum/flag/:commentId => flag a comment
 */
router.post('/flag/:commentId', ensureAuthenticated, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      req.flash('error_msg', 'Comment not found');
      return res.redirect('back');
    }
    comment.flagged = true;
    await comment.save();
    req.flash('success_msg', 'Comment flagged for moderation');
    res.redirect('back');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error flagging comment');
    res.redirect('back');
  }
});

module.exports = router;
