// routes/index.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  let trending = [];
  try {
    // fetch trending from TMDb
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=en-US`
    );
    trending = response.data.results || [];
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching trending items');
  }

  // For each trending item, check local rating
  for (let i = 0; i < trending.length; i++) {
    let t = trending[i];
    let found = await Movie.findOne({ tmdbId: t.id.toString() });
    if (found) {
      if (found.ratings.length > 0) {
        t.averageRating = found.averageRating;
      } else {
        t.averageRating = null;
      }
    } else {
      t.averageRating = null;
    }
  }

  // limit to 5
  trending = trending.slice(0, 5);

  // top 5 "Most Woke" for each category
  const topMovies = await Movie.find({
    contentType: 'Movie',
    ratings: { $exists: true, $ne: [] }
  }).sort({ averageRating: -1 }).limit(5);

  const topTV = await Movie.find({
    contentType: 'TV',
    ratings: { $exists: true, $ne: [] }
  }).sort({ averageRating: -1 }).limit(5);

  const topKids = await Movie.find({
    contentType: 'Kids',
    ratings: { $exists: true, $ne: [] }
  }).sort({ averageRating: -1 }).limit(5);

  // top 5 "Not Woke" (highest notWokeCount), ignoring zero counts
  const topNotWoke = await Movie.find({
    notWokeCount: { $gt: 0 }
  }).sort({ notWokeCount: -1 }).limit(5);

  res.render('index', {
    trending,
    topMovies,
    topTV,
    topKids,
    topNotWoke
  });
});

module.exports = router;
