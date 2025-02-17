// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// GET Movie Details
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum');
    if(!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }
    res.render('movie', { movie });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

// POST Add a Movie (if not available from API)
router.post('/add', ensureAuthenticated, async (req, res) => {
  const { tmdbId } = req.body;
  try {
    let movie = await Movie.findOne({ tmdbId });
    if(movie) {
      req.flash('success_msg', 'Movie already exists');
      return res.redirect(`/movies/${movie._id}`);
    }

    // Fetch details from TMDb API
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`);
    const data = response.data;

    movie = new Movie({
      title: data.title,
      tmdbId: tmdbId,
      description: data.overview,
      releaseDate: data.release_date,
      posterPath: data.poster_path
    });

    await movie.save();
    req.flash('success_msg', 'Movie added successfully');
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred while adding movie');
    res.redirect('/');
  }
});

module.exports = router;
