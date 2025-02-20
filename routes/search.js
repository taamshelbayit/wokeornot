// routes/search.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { q, minRating, category, contentType } = req.query;
  let query = {};

  // Filter by contentType
  if (contentType && ['Movie','TV','Kids'].includes(contentType)) {
    query.contentType = contentType;
  }

  // Filter by minRating
  if (minRating) {
    query.averageRating = { $gte: parseFloat(minRating) };
  }

  // Filter by category (in wokeCategoryCounts)
  if (category && category.trim() !== '') {
    const fieldName = `wokeCategoryCounts.${category}`;
    query[fieldName] = { $gt: 0 };
  }

  // Partial title match
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
