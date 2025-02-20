// routes/forum.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// POST /forum/add/:movieId => Add comment to a movie's forum
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { content } = req.body;
  try {
    const comment = new Comment({
      movie: req.params.movieId,
      user: req.user._id,
      content
    });
    await comment.save();

    const movie = await Movie.findById(req.params.movieId);
    movie.forum.push(comment._id);
    await movie.save();

    req.flash('success_msg', 'Comment added successfully');
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding comment');
    res.redirect(`/movies/${req.params.movieId}`);
  }
});

module.exports = router;
