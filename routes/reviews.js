// routes/reviews.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// POST Add a Review for a Movie
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { rating, content, categories } = req.body;
  const movieId = req.params.movieId;
  // Convert comma-separated categories to an array
  const categoryArray = categories ? categories.split(',').map(cat => cat.trim()) : [];

  try {
    const review = new Review({
      movie: movieId,
      user: req.user._id,
      rating,
      content,
      categories: categoryArray
    });
    await review.save();

    // Update Movie: add review reference and update average rating
    const movie = await Movie.findById(movieId);
    movie.reviews.push(review._id);
    movie.ratings.push(rating);
    movie.averageRating = movie.ratings.reduce((a, b) => a + b, 0) / movie.ratings.length;
    await movie.save();

    req.flash('success_msg', 'Review added successfully');
    res.redirect(`/movies/${movieId}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding review');
    res.redirect(`/movies/${movieId}`);
  }
});

module.exports = router;
