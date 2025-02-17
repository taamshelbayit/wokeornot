// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

// You could place this in routes/movies.js or a separate config file.
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
  "Queer Representation",
  "Drag",
  "Environmental Agenda",
  "Anti-Patriarchy"
];


// GET Add a Movie (if not available from API)
router.get('/add', ensureAuthenticated, async (req, res) => {
  try {
    // We read the 'tmdbId' from the query string instead of the body
    const { tmdbId } = req.query;
    if (!tmdbId) {
      req.flash('error_msg', 'No TMDb ID provided.');
      return res.redirect('/');
    }

    // Check if the movie already exists in our DB
    let movie = await Movie.findOne({ tmdbId });
    if (movie) {
      // If it exists, just redirect to its page
      return res.redirect(`/movies/${movie._id}`);
    }

    // If not found, fetch details from TMDb
    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`);
    const data = response.data;

    // Create a new Movie document
    movie = new Movie({
      title: data.title,
      tmdbId,
      description: data.overview,
      releaseDate: data.release_date,
      posterPath: data.poster_path
    });

    await movie.save();
    req.flash('success_msg', 'Movie added successfully');
    // Redirect to the new movie’s page
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred while adding movie');
    res.redirect('/');
  }
});

// GET Movie Details Page
//router.get('/:id', async (req, res) => {
//  try {
//    const movie = await Movie.findById(req.params.id)
//      .populate('reviews')
//      .populate('forum');
//    if (!movie) {
//      req.flash('error_msg', 'Movie not found');
//      return res.redirect('/');
//    }
//    res.render('movie', { movie });
//  } catch (err) {
//    console.error(err);
//    req.flash('error_msg', 'An error occurred');
//    res.redirect('/');
//  }
//});
//


// GET Movie Details
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum');
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // Your categories array
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

    // Pass both the movie and the category list to the template
    res.render('movie', { movie, wokeCategories });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});


module.exports = router;

