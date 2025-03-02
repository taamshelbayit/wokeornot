// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /search
 * 1) If "q" is provided => merges local DB + TMDb
 * 2) If no "q" => show advanced search form
 * 3) Sort param => ?sort=rating|popularity|releaseDate|title
 */
router.get('/', async (req, res) => {
  try {
    const q = req.query.q;              // e.g. /search?q=Batman
    const sortParam = req.query.sort || 'rating';

    // If user didn't type anything, show advanced form
    if (!q || q.trim() === '') {
      return res.render('advanced-search');
    }

    // 1) Local DB search
    const localResults = await Movie.find({
      title: { $regex: q.trim(), $options: 'i' }
    }).limit(100);

    // We'll keep them in finalResults
    let finalResults = [...localResults];

    // 2) TMDb calls for both movies & TV
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

    // 3) Upsert TMDb items into local DB
    for (let item of tmdbCombined) {
      const tmdbId = item.id.toString();
      let found = await Movie.findOne({ tmdbId });
      if (!found) {
        let newDoc = new Movie({
          title: item.title || item.name || 'Untitled',
          tmdbId,
          description: item.overview || '',
          releaseDate: item.release_date || item.first_air_date,
          posterPath: item.poster_path || '',
          contentType: item.media_type === 'tv' ? 'TV' : 'Movie',
          popularity: item.popularity || 0
        });
        await newDoc.save();
        finalResults.push(newDoc);
      } else {
        // If not already in finalResults, add it
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

    // 5) Sort by user’s chosen param
    sortResults(uniqueResults, sortParam);

    // 6) Limit to 100
    uniqueResults = uniqueResults.slice(0, 100);

    // 7) Render advanced-search-results.ejs (always HTML)
    return res.render('advanced-search-results', { results: uniqueResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing search');
    return res.redirect('/');
  }
});

/**
 * POST /search => advanced local-only search
 * Body fields: { title, minRating, maxRating, notWoke, contentType, sortParam }
 */
router.post('/', async (req, res) => {
  try {
    const { title, minRating, maxRating, notWoke, contentType, sortParam } = req.body;
    let query = {};

    // Build the local DB query
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

    // Local results only
    let results = await Movie.find(query).limit(200);

    // Sort them
    sortResults(results, sortParam || 'rating');

    // Limit final
    results = results.slice(0, 100);

    // Render advanced-search-results.ejs
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

/**
 * Helper function to sort results in place
 * sortParam => "rating" (default) | "popularity" | "releaseDate" | "title"
 */
function sortResults(arr, sortParam) {
  if (sortParam === 'popularity') {
    arr.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (sortParam === 'releaseDate') {
    // newest first
    arr.sort((a, b) => {
      let bd = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      let ad = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      return bd - ad;
    });
  } else if (sortParam === 'title') {
    // alphabetical A-Z
    arr.sort((a, b) => {
      let at = a.title.toLowerCase();
      let bt = b.title.toLowerCase();
      return at.localeCompare(bt);
    });
  } else {
    // "rating" => averageRating desc
    arr.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  }
}

module.exports = router;
