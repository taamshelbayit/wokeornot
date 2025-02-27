// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /search
 * - If there's a "q" param => do both local DB search & TMDb search
 * - If no "q" => show advanced search form
 */
router.get('/', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim() === '') {
      // No query => show advanced search form
      return res.render('advanced-search');
    }

    // 1) Local DB search
    const localResults = await Movie.find({
      title: { $regex: q.trim(), $options: 'i' }
    }).limit(100);

    // We'll store them in an array
    let finalResults = [...localResults];

    // 2) Also fetch from TMDb (both movies & TV) so we don’t miss anything
    const apiKey = process.env.TMDB_API_KEY;
    const [movResp, tvResp] = await Promise.all([
      axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}&page=1`
      ),
      axios.get(
        `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}&page=1`
      )
    ]);

    let tmdbMovies = movResp.data.results || [];
    let tmdbTV = tvResp.data.results || [];
    let tmdbCombined = [...tmdbMovies, ...tmdbTV];

    // 3) Upsert TMDb items into our local DB
    for (let item of tmdbCombined) {
      const tmdbId = item.id.toString();
      let found = await Movie.findOne({ tmdbId });
      if (!found) {
        // Create new doc
        let newDoc = new Movie({
          title: item.title || item.name || 'Untitled',
          tmdbId,
          description: item.overview || '',
          releaseDate: item.release_date || item.first_air_date,
          posterPath: item.poster_path || '',
          contentType: item.media_type === 'tv' ? 'TV' : 'Movie'
        });
        await newDoc.save();
        finalResults.push(newDoc);
      } else {
        // Already in DB => just push it if not already in finalResults
        if (!finalResults.find(r => r._id.equals(found._id))) {
          finalResults.push(found);
        }
      }
    }

    // 4) Remove duplicates
    let uniqueMap = new Map();
    let uniqueResults = [];
    for (let r of finalResults) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // 5) Sort by averageRating desc, or however you prefer
    uniqueResults.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

    // Limit to 100 to avoid huge results
    uniqueResults = uniqueResults.slice(0, 100);

    // 6) Render results using your advanced-search-results.ejs
    return res.render('advanced-search-results', { results: uniqueResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing search');
    return res.redirect('/');
  }
});

/**
 * POST /search => advanced search (local DB only) with fields:
 *   title, minRating, maxRating, notWoke, contentType
 */
router.post('/', async (req, res) => {
  try {
    const { title, minRating, maxRating, notWoke, contentType } = req.body;
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
      query.notWokeCount = { $gt: 0 };
    }

    const results = await Movie.find(query).sort({ averageRating: -1 }).limit(100);
    return res.render('advanced-search-results', { results });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing advanced search');
    res.redirect('/');
  }
});

/**
 * POST /search/save => user saves a search query
 */
router.post('/save', ensureAuthenticated, async (req, res) => {
  try {
    const { searchName, queryString } = req.body;
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
