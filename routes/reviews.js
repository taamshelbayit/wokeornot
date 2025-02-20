// routes/reviews.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// POST /reviews/add/:movieId => Add rating & categories
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { rating, content, categories } = req.body;
  let categoryArray = [];

  if (categories) {
    if (Array.isArray(categories)) {
      categoryArray = categories;
    } else {
      categoryArray = [categories];
    }
  }

  try {
    const review = new Review({
      movie: req.params.movieId,
      user: req.user._id,
      rating,
      content,
      categories: categoryArray
    });
    await review.save();

    // Update movie rating
    const movie = await Movie.findById(req.params.movieId);
    movie.ratings.push(rating);
    let total = movie.ratings.reduce((sum, val) => sum + parseFloat(val), 0);
    movie.averageRating = total / movie.ratings.length;

    // Increment wokeCategoryCounts
    categoryArray.forEach(cat => {
      const current = movie.wokeCategoryCounts.get(cat) || 0;
      movie.wokeCategoryCounts.set(cat, current + 1);
    });

    movie.reviews.push(review._id);
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
