// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// GET /search => merges local DB + TMDb, supports pagination & "Load More"
router.get('/', async (req, res) => {
  try {
    const q = req.query.q;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const sortParam = req.query.sort || 'rating'; // rating|popularity|releaseDate|title

    if (!q || q.trim() === '') {
      // no query => show advanced search
      return res.render('advanced-search');
    }

    // 1) local DB search (unpaginated for now)
    let localResults = await Movie.find({
      title: { $regex: q.trim(), $options: 'i' }
    });

    // 2) fetch from TMDb
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

    // 3) upsert
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
        if (!finalResults.find(r => r._id.equals(found._id))) {
          finalResults.push(found);
        }
      }
    }

    // 4) remove duplicates
    let uniqueMap = new Map();
    let uniqueResults = [];
    for (let r of finalResults) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // 5) sort by sortParam
    uniqueResults = sortResults(uniqueResults, sortParam);

    // 6) pagination
    const total = uniqueResults.length;
    const pageResults = uniqueResults.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    // if AJAX => return JSON for "Load More"
    if (req.xhr) {
      return res.json({
        items: pageResults,
        currentPage: page,
        totalPages,
        totalCount: total
      });
    }

    // else => normal HTML
    res.render('search-results', {
      results: pageResults,
      q,
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

// POST /search => advanced local-only
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

    let results = await Movie.find(query);
    results = sortResults(results, sortParam || 'rating');
    results = results.slice(0, 100);

    res.render('advanced-search-results', { results });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing advanced search');
    res.redirect('/');
  }
});

// Helper for sorting
function sortResults(arr, sortParam) {
  if (sortParam === 'popularity') {
    return arr.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (sortParam === 'releaseDate') {
    return arr.sort((a, b) => {
      let bd = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      let ad = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      return bd - ad;
    });
  } else if (sortParam === 'title') {
    return arr.sort((a, b) => (a.title.toLowerCase()).localeCompare(b.title.toLowerCase()));
  } else {
    // rating
    return arr.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  }
}

module.exports = router;