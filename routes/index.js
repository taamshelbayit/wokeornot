// routes/index.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;

    // 1) Fetch trending from TMDb
    const trendingRes = await axios.get(
      `https://api.themoviedb.org/3/trending/all/day?api_key=${apiKey}&language=en-US`
    );
    let heroItems = trendingRes.data.results.slice(0, 3);

    // 2) Local DB queries for top sections
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

    const topNotWoke = await Movie.find({
      notWokeCount: { $gt: 0 }
    }).sort({ notWokeCount: -1 }).limit(5);

    // 3) Render index.ejs
    res.render('index', {
      heroItems,
      topMovies,
      topTV,
      topKids,
      topNotWoke
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading homepage');
    return res.redirect('/');
  }
});

module.exports = router;
