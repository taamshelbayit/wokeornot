// routes/index.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Home Page – Show trending movies/TV shows from TMDb
router.get('/', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(`https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}`);
    const trending = response.data.results;
    res.render('index', { trending });
  } catch (err) {
    console.error(err);
    res.render('index', { trending: [] });
  }
});

module.exports = router;
