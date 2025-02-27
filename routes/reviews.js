// routes/reviews.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const Review = require('../models/Review');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * POST /reviews/add/:movieId
 * - Check if user already rated => block or let them update
 * - Mark as Not Woke or star rating
 * - Award badges
 * - Notify admin
 */
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  try {
    const { rating, content, categories, notWoke } = req.body;
    const movie = await Movie.findById(req.params.movieId);
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // 1) Check if user has already rated this movie
    const existingReview = await Review.findOne({
      movie: movie._id,
      user: req.user._id
    });
    if (existingReview) {
      // If you want to block multiple ratings:
      req.flash('error_msg', 'You have already rated this movie');
      return res.redirect(`/movies/${movie._id}`);
      // OR you could let them update:
      // existingReview.rating = notWoke === 'on' ? 0 : parseInt(rating, 10);
      // existingReview.content = content || '';
      // existingReview.categories = Array.isArray(categories) ? categories : [categories];
      // await existingReview.save();
      // Recalc movie average, etc. Then redirect.
    }

    // 2) Prepare the new review
    let categoryArray = [];
    if (categories) {
      if (Array.isArray(categories)) {
        categoryArray = categories;
      } else {
        categoryArray = [categories];
      }
    }

    const reviewData = {
      movie: movie._id,
      user: req.user._id,
      content: content || '',
      categories: categoryArray,
      rating: 0
    };

    if (notWoke === 'on') {
      reviewData.rating = 0;
    } else {
      reviewData.rating = parseInt(rating, 10);
    }

    const review = new Review(reviewData);
    await review.save();

    // 3) Update the movie doc
    if (notWoke === 'on') {
      movie.notWokeCount = (movie.notWokeCount || 0) + 1;
    } else {
      movie.ratings.push(reviewData.rating);
      const total = movie.ratings.reduce((sum, val) => sum + val, 0);
      movie.averageRating = total / movie.ratings.length;
    }
    movie.reviews.push(review._id);
    await movie.save();

    // 4) Award badges if user hits certain milestones
    const userReviewsCount = await Review.countDocuments({ user: req.user._id });
    if (userReviewsCount === 10 && !req.user.badges.includes('10-reviews')) {
      req.user.badges.push('10-reviews');
      await req.user.save();
    } else if (userReviewsCount === 50 && !req.user.badges.includes('50-reviews')) {
      req.user.badges.push('50-reviews');
      await req.user.save();
    }
    // Could add more achievements, e.g. "first-not-woke" if rating=0, etc.

    // 5) Notify admin(s)
    const admins = await User.find({ role: 'admin' });
    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        message: `New rating for "${movie.title}" by ${req.user.firstName}`,
        link: `/movies/${movie._id}`,
        read: false
      });
    }

    req.flash('success_msg', 'Review added successfully');
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding review');
    res.redirect('/');
  }
});

module.exports = router;
