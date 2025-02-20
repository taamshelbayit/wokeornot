// routes/search.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { q, minRating, category, contentType } = req.query;

  let query = {};

  // Filter by contentType if provided
  if (contentType && ['Movie','TV','Kids'].includes(contentType)) {
    query.contentType = contentType;
  }

  // Filter by minRating if provided
  if (minRating) {
    query.averageRating = { $gte: parseFloat(minRating) };
  }

  // Filter by category if provided
  // We stored categories in reviews, but also aggregated them in movie.wokeCategoryCounts
  // If we want to find movies that have a certain category count > 0:
  if (category && category.trim() !== '') {
    // Mongoose doesn't do a direct query on Map fields easily
    // We can do a workaround using the field name "wokeCategoryCounts.<category>"
    const fieldName = `wokeCategoryCounts.${category}`;
    query[fieldName] = { $gt: 0 };
  }

  // Title search (case-insensitive partial)
  if (q && q.trim() !== '') {
    query.title = { $regex: q.trim(), $options: 'i' };
  }

  try {
    const results = await Movie.find(query).limit(50);
    res.render('search', { results });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
