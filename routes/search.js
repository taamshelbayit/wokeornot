// routes/search.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { minRating, category } = req.query;
  let query = {};

  // Filter by rating if provided
  if (minRating) {
    query.averageRating = { $gte: parseFloat(minRating) };
  }

  // Filter by category if provided
  // This depends on how you store categories in your Movie or Review schema.
  // If you store an array of categories in Movie, e.g. movie.categories = [...]
  // Then you can do:
  if (category && category.trim() !== "") {
    query["reviews.categories"] = category;
    // or query.categories = category if categories are stored directly in Movie
  }

  try {
    // Possibly need a .populate('reviews') or an aggregation if categories are in reviews
    // For simplicity, we assume categories are in the Movie doc.
    const results = await Movie.find(query).limit(30);
    res.render('search', { results });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
