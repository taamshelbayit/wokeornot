// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /search
 * - If no `q`, we render the advanced search form with an empty `results` array
 * - If `q` is present => merges local DB + TMDb with pagination
 * - Supports ?page=1..N, ?sort=rating|popularity|releaseDate|title|notWokeDesc
 * - If AJAX => return JSON for “Load More”
 */
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const sortParam = req.query.sort || 'rating';

    // If no search query => show advanced search form but pass { results: [] }
    if (!q) {
      return res.render('advanced-search', { results: [] });
    }

    // 1) Local DB search (partial title match)
    const localResults = await Movie.find({
      title: { $regex: q, $options: 'i' }
    });

    // 2) TMDb calls
    const apiKey = process.env.TMDB_API_KEY;
    const [movResp, tvResp] = await Promise.all([
      axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q)}&page=1`
      ),
      axios.get(
        `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q)}&page=1`
      )
    ]);

    let tmdbMovies = movResp.data.results || [];
    let tmdbTV = tvResp.data.results || [];
    let tmdbCombined = [...tmdbMovies, ...tmdbTV];

    // 3) Upsert into local DB
    let finalResults = [...localResults];
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
        // If found but not in finalResults, push it
        if (!finalResults.find(r => r._id.equals(found._id))) {
          finalResults.push(found);
        }
      }
    }

    // 4) Remove duplicates
    const uniqueMap = new Map();
    const uniqueResults = [];
    for (let r of finalResults) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // 5) Sort
    const sortedResults = sortResults(uniqueResults, sortParam);

    // 6) Pagination
    const total = sortedResults.length;
    const pageResults = sortedResults.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    // If AJAX => return JSON
    if (req.xhr) {
      return res.json({
        items: pageResults,
        currentPage: page,
        totalPages,
        totalCount: total
      });
    }

    // Else => normal HTML => search-results.ejs
    res.render('search-results', {
      q,
      results: pageResults,
      currentPage: page,
      totalPages,
      totalCount: total,
      limit,
      sortParam
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing search');
    res.redirect('/');
  }
});

/**
 * POST /search => advanced local-only search
 * Body: { title, minRating, maxRating, notWoke, contentType, sortParam }
 * Renders advanced-search-results.ejs
 */
router.post('/', async (req, res) => {
  try {
    const { title, minRating, maxRating, notWoke, contentType, sortParam } = req.body;
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

    let results = await Movie.find(query).limit(500); // bigger limit for local
    results = sortResults(results, sortParam || 'rating');
    results = results.slice(0, 100);

    res.render('advanced-search-results', { results });
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

// Helper for sorting
function sortResults(arr, sortParam) {
  switch (sortParam) {
    case 'popularity':
      return arr.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    case 'releaseDate':
      return arr.sort((a, b) => {
        let bd = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        let ad = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        return bd - ad;
      });
    case 'title':
      return arr.sort((a, b) => {
        let at = a.title.toLowerCase();
        let bt = b.title.toLowerCase();
        return at.localeCompare(bt);
      });
    case 'notWokeDesc':
      return arr.sort((a, b) => (b.notWokeCount || 0) - (a.notWokeCount || 0));
    case 'ratingDesc':
    case 'rating':
    default:
      // default => highest rating first
      return arr.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  }
}

module.exports = router;
