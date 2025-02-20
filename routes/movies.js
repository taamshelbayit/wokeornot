// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// 1) /movies/trending/:tmdbId => upsert into DB, redirect to detail page
router.get('/trending/:tmdbId', async (req, res) => {
  try {
    const tmdbId = req.params.tmdbId;
    let movie = await Movie.findOne({ tmdbId });
    if (!movie) {
      const apiKey = process.env.TMDB_API_KEY;
      const response = await axios.get(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=en-US`
      );
      const data = response.data;
      movie = new Movie({
        title: data.title || data.name || 'Untitled',
        tmdbId,
        description: data.overview || '',
        releaseDate: data.release_date || data.first_air_date,
        posterPath: data.poster_path,
        contentType: 'Movie'
      });
      await movie.save();
    }
    // Now redirect to detail page for immediate rating
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading trending item');
    res.redirect('/');
  }
});

// 2) /movies?type=Movie|TV|Kids => list from DB
router.get('/', async (req, res) => {
  try {
    const contentType = req.query.type || 'Movie';
    const movies = await Movie.find({ contentType })
      .sort({ averageRating: -1 })
      .limit(50);
    res.render('list', { movies, contentType });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching items');
    res.redirect('/');
  }
});

// 3) /movies/:id => detail page
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum');
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // Convert wokeCategoryCounts to array
    const categoryCounts = [];
    for (let [cat, count] of movie.wokeCategoryCounts) {
      categoryCounts.push({ category: cat, count });
    }

    res.render('movie', { movie, categoryCounts });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

module.exports = router;
