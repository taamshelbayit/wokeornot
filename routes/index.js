// routes/index.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  let trending = [];
  try {
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=en-US`
    );
    trending = response.data.results || [];
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching trending items');
  }

  // For each trending item, check if we have a rating in DB
  for (let i = 0; i < trending.length; i++) {
    let t = trending[i];
    let found = await Movie.findOne({ tmdbId: t.id.toString() });
    if (found) {
      if (found.ratings.length > 0) {
        t.averageRating = found.averageRating;
      } else {
        t.averageRating = null; // "No Ratings"
      }
    } else {
      t.averageRating = null; // Not in DB
    }
  }

  res.render('index', { trending });
});

module.exports = router;
