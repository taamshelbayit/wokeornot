// routes/reviews.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { rating, content, categories, notWoke } = req.body;
  // "notWoke" will be "on" if user checked "Mark as Not Woke"

  let categoryArray = [];
  if (categories) {
    if (Array.isArray(categories)) {
      categoryArray = categories;
    } else {
      categoryArray = [categories];
    }
  }

  try {
    const reviewData = {
      movie: req.params.movieId,
      user: req.user._id,
      content,
      categories: categoryArray
    };

    // If user chose "Not Woke", skip star rating
    if (notWoke === 'on') {
      reviewData.rating = 0; // or you can store null if your schema allows
    } else {
      // user picked a star rating
      reviewData.rating = rating;
    }

    const review = new Review(reviewData);
    await review.save();

    // Update the movie doc
    const movie = await Movie.findById(req.params.movieId);

    // If "Not Woke" => increment notWokeCount
    if (notWoke === 'on') {
      movie.notWokeCount += 1;
    } else {
      // star rating logic
      movie.ratings.push(rating);
      const total = movie.ratings.reduce((sum, val) => sum + parseFloat(val), 0);
      movie.averageRating = total / movie.ratings.length;

      // increment wokeCategoryCounts
      categoryArray.forEach(cat => {
        const current = movie.wokeCategoryCounts.get(cat) || 0;
        movie.wokeCategoryCounts.set(cat, current + 1);
      });
    }

    // link the review
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
