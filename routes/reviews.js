// routes/reviews.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// POST Add a Review for a Movie
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { rating, content } = req.body;
  let categories = req.body.categories;

  // Normalize categories to always be an array
  let categoryArray = [];
  if (!categories) {
    // No checkboxes selected
    categoryArray = [];
  } else if (Array.isArray(categories)) {
    // Multiple checkboxes selected
    categoryArray = categories;
  } else {
    // Only one checkbox selected => a single string
    categoryArray = [categories];
  }

  try {
    // Create and save the new review
    const review = new Review({
      movie: req.params.movieId,
      user: req.user._id,
      rating,
      content,
      categories: categoryArray
    });
    await review.save();

    // Update the movie's average rating
    const movie = await Movie.findById(req.params.movieId);
    movie.reviews.push(review._id);
    movie.ratings.push(rating);

    // Calculate new average
    const total = movie.ratings.reduce((sum, val) => sum + parseFloat(val), 0);
    movie.averageRating = total / movie.ratings.length;

    await movie.save();

    req.flash('success_msg', 'Review added successfully');
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding review');
    res.redirect(`/movies/${req.params.movieId}`);
  }
});

module.exports = router;

