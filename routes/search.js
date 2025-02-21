// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

/**
 * GET /search
 * If user doesn't specify contentType, we search local DB (all contentTypes)
 * and also do BOTH /search/movie and /search/tv from TMDb.
 * If user picks "Movie", we do local DB with { contentType: 'Movie' } + TMDb /search/movie.
 * If user picks "TV", we do local DB with { contentType: 'TV' } + TMDb /search/tv.
 * If user picks "Kids", we do local DB with { contentType: 'Kids' } + TMDb /search/movie.
 */
router.get('/', async (req, res) => {
  const { q, minRating, category, contentType } = req.query;

  // 1) Build local DB query
  let localQuery = {};

  // If contentType is one of Movie, TV, Kids, use it
  if (contentType && ['Movie', 'TV', 'Kids'].includes(contentType)) {
    localQuery.contentType = contentType;
  }

  // Filter by minRating
  if (minRating) {
    localQuery.averageRating = { $gte: parseFloat(minRating) };
  }

  // Filter by woke category in wokeCategoryCounts
  if (category && category.trim() !== '') {
    const fieldName = `wokeCategoryCounts.${category}`;
    localQuery[fieldName] = { $gt: 0 };
  }

  // Title partial match in local DB
  if (q && q.trim() !== '') {
    localQuery.title = { $regex: q.trim(), $options: 'i' };
  }

  try {
    // 2) Search local DB
    let localResults = await Movie.find(localQuery).limit(50);

    // 3) Also fetch from TMDb if user typed a query
    let tmdbResults = [];
    if (q && q.trim() !== '') {
      const apiKey = process.env.TMDB_API_KEY;
      let movieEndpoint = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}&page=1`;
      let tvEndpoint = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}&page=1`;

      if (!contentType) {
        // No contentType => do both /search/movie and /search/tv
        let [movieResp, tvResp] = await Promise.all([
          axios.get(movieEndpoint),
          axios.get(tvEndpoint)
        ]);
        tmdbResults = [
          ...(movieResp.data.results || []),
          ...(tvResp.data.results || [])
        ];
      } else if (contentType === 'TV') {
        // contentType=TV => only /search/tv
        let tvResp = await axios.get(tvEndpoint);
        tmdbResults = tvResp.data.results || [];
      } else {
        // contentType=Movie or Kids => do /search/movie
        let movieResp = await axios.get(movieEndpoint);
        tmdbResults = movieResp.data.results || [];
      }
    }

    // 4) Convert localResults => array with db=true
    let finalLocal = localResults.map(l => ({
      db: true,
      _id: l._id,
      title: l.title,
      posterPath: l.posterPath,
      averageRating: (l.ratings.length > 0) ? l.averageRating : null,
      notWokeCount: l.notWokeCount || 0,
      ratings: l.ratings // if we need the array length
    }));

    // 5) Convert TMDb results => skip if found in DB
    let finalExternal = [];
    for (let item of tmdbResults) {
      let found = await Movie.findOne({ tmdbId: item.id.toString() });
      if (!found) {
        finalExternal.push({
          db: false,
          tmdbId: item.id,
          title: item.title || item.name || 'Untitled',
          posterPath: item.poster_path,
          averageRating: null,
          notWokeCount: 0,
          ratings: []
        });
      }
    }

    // 6) Combine
    let combinedResults = [...finalLocal, ...finalExternal];

    // Render search.ejs
    res.render('search', { combinedResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
