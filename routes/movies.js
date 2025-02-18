// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// Predefined list of Woke Categories (can be placed here or in a separate file)
const wokeCategories = [
  "Transgender Themes",
  "Gay Marriage",
  "Race Swapping",
  "Feminist Agenda",
  "LGBT Representation",
  "Gender Nonconformity",
  "Allyship",
  "Diversity Casting",
  "Intersectionality",
  "Equity Over Merit",
  "Gender Swapping",
  "Political",
  "Queer Representation",
  "Drag",
  "Environmental Agenda",
  "Anti-Patriarchy"
];

// GET /movies/add?tmdbId=123
// If the movie doesn't exist, fetch details from TMDb and create a new record
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
      // If it exists, redirect to its page
      return res.redirect(`/movies/${movie._id}`);
    }

    // Fetch from TMDb
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`
    );
    const data = response.data;

    // Create new Movie document
    movie = new Movie({
      title: data.title,
      tmdbId,
      description: data.overview,
      releaseDate: data.release_date,
      posterPath: data.poster_path
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

// GET /movies/:id
// Displays a specific movie with woke categories, reviews, and forum
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum');

    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // Pass both the movie and the category list to the template
    res.render('movie', { movie, wokeCategories });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

module.exports = router;
