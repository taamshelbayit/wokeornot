// routes/search.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /search => show advanced search form
 */
router.get('/', (req, res) => {
  // Render an advanced-search.ejs form
  res.render('advanced-search');
});

/**
 * POST /search => process advanced search
 * e.g. body might have {title, minRating, maxRating, categories, contentType, etc.}
 */
router.post('/', async (req, res) => {
  try {
    const { title, minRating, maxRating, notWoke, contentType } = req.body;
    // Build a query for local DB
    let query = {};

    if (contentType) {
      query.contentType = contentType;
    }
    if (title && title.trim() !== '') {
      query.title = { $regex: title.trim(), $options: 'i' };
    }
    if (minRating) {
      query.averageRating = { $gte: parseFloat(minRating) };
    }
    if (maxRating) {
      query.averageRating = query.averageRating || {};
      query.averageRating.$lte = parseFloat(maxRating);
    }
    if (notWoke === 'on') {
      // e.g. query.notWokeCount = { $gt: 0 };
      query.notWokeCount = { $gt: 0 };
    }

    // Now fetch from DB
    const results = await Movie.find(query).sort({ averageRating: -1 }).limit(100);
    res.render('advanced-search-results', { results });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing advanced search');
    res.redirect('/');
  }
});

/**
 * POST /search/save => user saves a search query as "watchlist" or "saved search"
 */
router.post('/save', ensureAuthenticated, async (req, res) => {
  try {
    const { searchName, queryString } = req.body;
    // We store the search parameters in user's watchlist or "savedSearches" array
    // e.g. user.savedSearches.push({ name: searchName, query: queryString })
    req.user.savedSearches = req.user.savedSearches || [];
    req.user.savedSearches.push({
      name: searchName,
      query: queryString,
      createdAt: new Date()
    });
    await req.user.save();

    req.flash('success_msg', 'Search saved successfully');
    res.redirect('/search');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error saving search');
    res.redirect('/search');
  }
});

module.exports = router;
