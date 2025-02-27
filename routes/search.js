// routes/search.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /search
 * - If there's a "q" param, do a quick local DB search by title
 * - Otherwise, show the advanced search form
 */
router.get('/', async (req, res) => {
  try {
    const q = req.query.q; // e.g. /search?q=Batman
    if (q && q.trim() !== '') {
      // 1) Simple search by title
      const results = await Movie.find({
        title: { $regex: q.trim(), $options: 'i' }
      })
        .sort({ averageRating: -1 })
        .limit(100);

      // Render the same template as advanced results
      return res.render('advanced-search-results', { results });
    } else {
      // 2) No "q" => show the advanced search form
      return res.render('advanced-search');
    }
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing search');
    return res.redirect('/');
  }
});

/**
 * POST /search
 * - Handles the advanced search with body fields:
 *   { title, minRating, maxRating, notWoke, contentType, etc. }
 */
router.post('/', async (req, res) => {
  try {
    const { title, minRating, maxRating, notWoke, contentType } = req.body;
    let query = {};

    // contentType => 'Movie', 'TV', 'Kids'
    if (contentType) {
      query.contentType = contentType;
    }
    // title partial match
    if (title && title.trim() !== '') {
      query.title = { $regex: title.trim(), $options: 'i' };
    }
    // minRating
    if (minRating) {
      query.averageRating = { $gte: parseFloat(minRating) };
    }
    // maxRating
    if (maxRating) {
      query.averageRating = query.averageRating || {};
      query.averageRating.$lte = parseFloat(maxRating);
    }
    // notWoke => only items with notWokeCount > 0
    if (notWoke === 'on') {
      query.notWokeCount = { $gt: 0 };
    }

    // Perform local DB search
    const results = await Movie.find(query).sort({ averageRating: -1 }).limit(100);

    // Render your existing advanced-search-results.ejs
    res.render('advanced-search-results', { results });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing advanced search');
    res.redirect('/');
  }
});

/**
 * POST /search/save => store the advanced search or watchlist query
 */
router.post('/save', ensureAuthenticated, async (req, res) => {
  try {
    const { searchName, queryString } = req.body;

    // Save the query to user.savedSearches (array)
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
