// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { q, minRating, category, contentType } = req.query;

  // 1) Build a query for local DB
  let localQuery = {};

  // Filter by contentType (Movie, TV, Kids) if provided
  if (contentType && ['Movie', 'TV', 'Kids'].includes(contentType)) {
    localQuery.contentType = contentType;
  }

  // Filter by minRating
  if (minRating) {
    localQuery.averageRating = { $gte: parseFloat(minRating) };
  }

  // Filter by category (in wokeCategoryCounts map)
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

    // 3) Also fetch from TMDb if user typed a search query (q)
    let tmdbResults = [];
    if (q && q.trim() !== '') {
      // Decide endpoint: by default, let's use /search/movie
      // (You can adapt for /search/tv if contentType === 'TV')
      const apiKey = process.env.TMDB_API_KEY;
      let endpoint = 'search/movie';
      if (contentType === 'TV') {
        endpoint = 'search/tv';
      }
      // For Kids, we can just do search/movie. Or add a discover param for family genre.

      const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}&page=1`;
      const tmdbResp = await axios.get(tmdbUrl);
      tmdbResults = tmdbResp.data.results || [];
    }

    // 4) Convert localResults to a consistent format
    // We'll mark them with db: true
    let finalLocal = localResults.map(l => ({
      db: true,
      _id: l._id,               // local DB id
      title: l.title,
      posterPath: l.posterPath,
      averageRating: (l.ratings.length > 0) ? l.averageRating : null,
    }));

    // 5) Convert TMDb results, skipping any that exist in local DB
    let finalExternal = [];
    for (let item of tmdbResults) {
      // Check if we already have it
      let found = await Movie.findOne({ tmdbId: item.id.toString() });
      if (!found) {
        // Not in DB => show "Rate Now"
        finalExternal.push({
          db: false,
          tmdbId: item.id,
          title: item.title || item.name || 'Untitled',
          posterPath: item.poster_path,
          averageRating: null // "No Ratings" until user upserts
        });
      }
      // if found, user can see it in finalLocal already
    }

    // 6) Merge local + external
    let combinedResults = [...finalLocal, ...finalExternal];

    // Render
    res.render('search', { combinedResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
