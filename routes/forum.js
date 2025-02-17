// routes/forum.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// POST Add a Forum Comment for a Movie
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { content } = req.body;
  const movieId = req.params.movieId;
  try {
    const comment = new Comment({
      movie: movieId,
      user: req.user._id,
      content
    });
    await comment.save();

    // Add comment to the movie's forum array
    const movie = await Movie.findById(movieId);
    movie.forum.push(comment._id);
    await movie.save();

    req.flash('success_msg', 'Comment added successfully');
    res.redirect(`/movies/${movieId}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding comment');
    res.redirect(`/movies/${movieId}`);
  }
});

module.exports = router;
