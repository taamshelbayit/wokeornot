// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// GET Add a Movie
router.get('/add', ensureAuthenticated, async (req, res) => {
  try {
    const { tmdbId } = req.query;
    if (!tmdbId) {
      req.flash('error_msg', 'No TMDb ID provided.');
      return res.redirect('/');
    }

    // Check if the movie already exists
    let movie = await Movie.findOne({ tmdbId });
    if (movie) {
      return res.redirect(`/movies/${movie._id}`);
    }

    // Fetch details from TMDb
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`
    );
    const data = response.data;

    // Create new Movie doc
    movie = new Movie({
      title: data.title,
      tmdbId,
      description: data.overview,
      releaseDate: data.release_date,
      posterPath: data.poster_path,
      // Default contentType is 'Movie', but you could add logic to set it
    });

    await movie.save();
    req.flash('success_msg', 'Movie added successfully');
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding movie');
    res.redirect('/');
  }
});

// GET /movies?type=Movie/TV/Kids => Show a list of that content type
router.get('/', async (req, res) => {
  try {
    const contentType = req.query.type || 'Movie';
    const movies = await Movie.find({ contentType })
      .sort({ averageRating: -1 })
      .limit(50);

    // We'll render a new "list.ejs" that shows all items for the chosen type
    res.render('list', { movies, contentType });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching movies');
    res.redirect('/');
  }
});

// GET /movies/:id => Show a single movie details
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum');
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // Convert wokeCategoryCounts (Map) to an array for easier display
    const categoryCounts = [];
    for (let [cat, count] of movie.wokeCategoryCounts) {
      categoryCounts.push({ category: cat, count });
    }

    // Pass both movie and the categoryCounts
    res.render('movie', { movie, categoryCounts });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

module.exports = router;
