// routes/reviews.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// POST Add a Review for a Movie
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { rating, content, categories } = req.body;
  let categoryArray = [];

  if (categories) {
    if (Array.isArray(categories)) {
      categoryArray = categories;
    } else {
      // If only one checkbox was selected, Express gives a string
      categoryArray = [categories];
    }
  }

  try {
    // Create and save new review
    const review = new Review({
      movie: req.params.movieId,
      user: req.user._id,
      rating,
      content,
      categories: categoryArray
    });
    await review.save();

    // Update the movie's average rating & wokeCategoryCounts
    const movie = await Movie.findById(req.params.movieId);

    // 1) Push rating
    movie.ratings.push(rating);
    const total = movie.ratings.reduce((sum, val) => sum + parseFloat(val), 0);
    movie.averageRating = total / movie.ratings.length;

    // 2) Increment category counts
    categoryArray.forEach(cat => {
      const currentCount = movie.wokeCategoryCounts.get(cat) || 0;
      movie.wokeCategoryCounts.set(cat, currentCount + 1);
    });

    // 3) Link the review
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
