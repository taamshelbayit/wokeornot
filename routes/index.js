// routes/index.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Movie = require('../models/Movie');

// Homepage route
router.get('/', async (req, res) => {
  try {
    // Example: Retrieve movies to display on the homepage
    const movies = await Movie.find();
    res.render('index', {
      title: 'Home',
      movies: movies,
      user: req.user
    });
  } catch (err) {
    console.error('Error loading homepage:', err);
    req.flash('error_msg', 'Error loading homepage');
    res.render('index', { title: 'Home', movies: [], user: req.user });
  }
});

module.exports = router;
