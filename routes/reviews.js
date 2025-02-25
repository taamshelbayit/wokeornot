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
 * Allows a user to rate a movie from 1–10 or mark it as Not Woke.
 * Also handles awarding a "10-reviews" badge if the user hits 10 reviews,
 * and notifies admins about the new rating.
 */
router.post('/add/:movieId', ensureAuthenticated, async (req, res) => {
  const { rating, content, categories, notWoke } = req.body;

  // Convert categories to an array if it's a single string
  let categoryArray = [];
  if (categories) {
    if (Array.isArray(categories)) {
      categoryArray = categories;
    } else {
      categoryArray = [categories];
    }
  }

  try {
    // 1) Create the new review
    const reviewData = {
      movie: req.params.movieId,
      user: req.user._id,
      content,
      categories: categoryArray
    };

    // If user marked "Not Woke," skip star rating
    if (notWoke === 'on') {
      reviewData.rating = 0; // store 0 to indicate Not Woke
    } else {
      // user picked a star rating
      reviewData.rating = parseInt(rating, 10);
    }

    const review = new Review(reviewData);
    await review.save();

    // 2) Update the movie doc
    const movie = await Movie.findById(req.params.movieId);
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    if (notWoke === 'on') {
      // increment notWokeCount
      movie.notWokeCount = (movie.notWokeCount || 0) + 1;
    } else {
      // push star rating
      movie.ratings.push(reviewData.rating);
      // recalc average
      const total = movie.ratings.reduce((sum, val) => sum + parseFloat(val), 0);
      movie.averageRating = total / movie.ratings.length;
    }

    // link the review
    movie.reviews.push(review._id);
    await movie.save();

    // 3) Award badges if user hits certain milestones
    // e.g. "10-reviews" badge
    const userReviewsCount = await Review.countDocuments({ user: req.user._id });
    if (userReviewsCount === 10) {
      // check if user doesn't have "10-reviews" badge
      if (!req.user.badges.includes('10-reviews')) {
        req.user.badges.push('10-reviews');
        await req.user.save();
      }
    }

    // (Optional) If you want a "Top Woke Rater" badge if rating >= 8, do:
    // if (reviewData.rating >= 8) {
    //   if (!req.user.badges.includes('top-woke-rater')) {
    //     req.user.badges.push('top-woke-rater');
    //     await req.user.save();
    //   }
    // }

    // 4) Notify admin(s) about the new rating
    const admins = await User.find({ role: 'admin' });
    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        message: `New rating for "${movie.title}" by ${req.user.name}`,
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
