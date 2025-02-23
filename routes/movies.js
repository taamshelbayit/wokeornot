// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /movies?type=Movie|TV|Kids&genre=XX
 * 1) If we have a 'genre' param, we call TMDb discover for that genre.
 * 2) We also store results in local DB if they don't exist (upsert).
 * 3) Then we render a "list.ejs" or something that shows all items.
 */
router.get('/', async (req, res) => {
  try {
    const contentType = req.query.type || 'Movie';
    const genre = req.query.genre; // e.g. 28 for Action, 35 for Comedy, etc.

    const apiKey = process.env.TMDB_API_KEY;
    let tmdbResults = [];

    // 1) Decide if we call discover/movie or discover/tv
    // For Kids, let's default to discover/movie but add 'with_genres=16,10751' or something
    let discoverEndpoint = '';

    if (contentType === 'TV') {
      discoverEndpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=en-US&sort_by=popularity.desc`;
      if (genre) {
        discoverEndpoint += `&with_genres=${genre}`;
      }
    } else if (contentType === 'Kids') {
      // For kids, we can do discover movie with family or animation
      // But if user picks a specific genre, we use that
      discoverEndpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc`;
      if (genre) {
        discoverEndpoint += `&with_genres=${genre}`;
      } else {
        // maybe default to Family or Animation
        discoverEndpoint += `&with_genres=16,10751`;
      }
    } else {
      // Default to Movie
      discoverEndpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc`;
      if (genre) {
        discoverEndpoint += `&with_genres=${genre}`;
      }
    }

    // 2) Fetch from TMDb discover
    const tmdbResp = await axios.get(discoverEndpoint);
    tmdbResults = tmdbResp.data.results || [];

    // 3) Upsert each item into local DB
    for (let item of tmdbResults) {
      let tmdbId = item.id.toString();
      let existing = await Movie.findOne({ tmdbId });

      if (!existing) {
        // create a new doc
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
          contentType, // "Movie", "TV", or "Kids"
        });

        await newMovie.save();
      }
    }

    // 4) Now query our DB for items with that contentType (and possibly filter by genre if we stored it)
    // For simplicity, let's just show the newly fetched items from TMDb
    // Or we can do:
    const movies = await Movie.find({ contentType })
      .sort({ averageRating: -1 })
      .limit(50);

    // 5) Render a "list.ejs" or similar
    res.render('list', { movies, contentType, genre });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching items');
    res.redirect('/');
  }
});

module.exports = router;
