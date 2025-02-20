// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /movies?type=Movie or TV or Kids
 * 1) Fetch from TMDb if not already in DB
 * 2) Store in DB
 * 3) Render list.ejs
 */
router.get('/', async (req, res) => {
  try {
    const contentType = req.query.type || 'Movie';

    // Decide which TMDb endpoint to call
    // For "Kids," we'll use discover with genre 10751 (Family)
    // For "TV," we call tv/popular
    // For "Movie," we call movie/popular
    const apiKey = process.env.TMDB_API_KEY;
    let tmdbUrl = '';

    if (contentType === 'TV') {
      tmdbUrl = `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=en-US&page=1`;
    } else if (contentType === 'Kids') {
      // Use "discover" with family genre = 10751
      tmdbUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=10751&language=en-US&page=1`;
    } else {
      // Default to movie/popular
      tmdbUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=1`;
    }

    // Fetch popular titles from TMDb
    const response = await axios.get(tmdbUrl);
    const tmdbResults = response.data.results || [];

    // For each item, upsert into our DB
    for (let item of tmdbResults) {
      let tmdbId = item.id.toString();
      let existing = await Movie.findOne({ tmdbId });

      if (!existing) {
        // Create a new doc
        let title = item.title || item.name || 'Untitled';
        let releaseDate = item.release_date || item.first_air_date;
        let posterPath = item.poster_path;
        let description = item.overview || '';

        let newMovie = new Movie({
          title,
          tmdbId,
          description,
          releaseDate,
          posterPath,
          contentType // "Movie", "TV", or "Kids"
        });

        await newMovie.save();
      }
    }

    // Now query our DB for items with that contentType
    const movies = await Movie.find({ contentType })
      .sort({ averageRating: -1 })
      .limit(50);

    res.render('list', { movies, contentType });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching items from TMDb');
    res.redirect('/');
  }
});

/**
 * GET /movies/:id => show detail page
 * Converts wokeCategoryCounts map to array for easy display
 */
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum');

    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // Convert wokeCategoryCounts map to array
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
