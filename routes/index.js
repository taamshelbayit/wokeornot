// routes/index.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie'); // if you want to store them in DB
require('dotenv').config();

/**
 * GET /
 * Show trending items from TMDb
 */
router.get('/', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=en-US`
    );
    const trending = response.data.results || [];

    // If you want, you can upsert them into your DB.
    // But often, for "trending," we just show them without storing.
    // We'll just pass them to EJS for display.
    res.render('index', { trending });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching trending items');
    res.render('index', { trending: [] });
  }
});

module.exports = router;
