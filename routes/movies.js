// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const Review = require('../models/Review'); // Added for category aggregation
const { ensureAuthenticated } = require('../utils/auth');

// 1) GET /movies => handle ?type=Movie|TV|Kids & ?genre=XX & optional q=title
router.get('/', async (req, res) => {
  try {
    const { type, genre, q } = req.query; // e.g. /movies?type=Movie&genre=35
    const contentType = type || 'Movie';

    // We'll fetch from TMDb (discover or search) & upsert into local DB
    const apiKey = process.env.TMDB_API_KEY;
    let tmdbResults = [];

    // Decide if user typed a q => search, or if just genre => discover
    if (q && q.trim() !== '') {
      // user typed a title => search
      if (contentType === 'TV') {
        const tvSearchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const tvResp = await axios.get(tvSearchUrl);
        tmdbResults = tvResp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      } else if (contentType === 'Kids') {
        const kidsSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const kidsResp = await axios.get(kidsSearchUrl);
        tmdbResults = kidsResp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      } else {
        const movSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const movResp = await axios.get(movSearchUrl);
        tmdbResults = movResp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      }
    } else if (genre) {
      // user only picked a genre => do discover
      if (contentType === 'TV') {
        const tvDiscover = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const tvResp = await axios.get(tvDiscover);
        tmdbResults = tvResp.data.results || [];
      } else if (contentType === 'Kids') {
        let kidsDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const kdResp = await axios.get(kidsDiscover);
        tmdbResults = kdResp.data.results || [];
      } else {
        const movDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const mdResp = await axios.get(movDiscover);
        tmdbResults = mdResp.data.results || [];
      }
    } else {
      // user just visited /movies => show local DB items
    }

    // 2) Upsert each item into local DB
    let finalList = [];
    for (let item of tmdbResults) {
      const tmdbId = item.id.toString();
      let found = await Movie.findOne({ tmdbId });
      if (!found) {
        const title = item.title || item.name || 'Untitled';
        const releaseDate = item.release_date || item.first_air_date;
        const posterPath = item.poster_path;
        const description = item.overview || '';
        let newDoc = new Movie({
          title,
          tmdbId,
          description,
          releaseDate,
          posterPath,
          contentType // "Movie", "TV", or "Kids"
        });
        await newDoc.save();
        finalList.push(newDoc);
      } else {
        finalList.push(found);
      }
    }

    // 3) Fetch local DB items for contentType
    let dbQuery = { contentType };
    let localDBItems = await Movie.find(dbQuery).sort({ averageRating: -1 }).limit(100);

    // Merge localDBItems + finalList
    let allItems = [...localDBItems];
    for (let doc of finalList) {
      if (!allItems.find(d => d._id.equals(doc._id))) {
        allItems.push(doc);
      }
    }

    // Remove duplicates
    let uniqueMap = new Map();
    let uniqueResults = [];
    for (let r of allItems) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // Render "list.ejs"
    res.render('list', { movies: uniqueResults, contentType });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching items');
    res.redirect('/');
  }
});

// 2) GET /movies/trending/:tmdbId => upsert from trending
router.get('/trending/:tmdbId', async (req, res) => {
  try {
    const tmdbId = req.params.tmdbId;
    let movie = await Movie.findOne({ tmdbId });
    if (!movie) {
      const apiKey = process.env.TMDB_API_KEY;
      const response = await axios.get(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`
      );
      const data = response.data;

      movie = new Movie({
        title: data.title || data.name || 'Untitled',
        tmdbId,
        description: data.overview,
        releaseDate: data.release_date || data.first_air_date,
        posterPath: data.poster_path,
        contentType: 'Movie'
      });
      await movie.save();
    }
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading trending item');
    res.redirect('/');
  }
});

// 3) GET /movies/:id => detail page
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum'); // if you have a forum array
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // Calculate categoryCounts from reviews for the woke category trends chart
    const categoryCounts = await Review.aggregate([
      { $match: { movie: movie._id } }, // Match reviews for this movie
      { $unwind: '$categories' },       // Flatten the categories array
      { $group: { _id: '$categories', count: { $sum: 1 } } }, // Count each category
      { $project: { category: '$_id', count: 1, _id: 0 } }    // Format output
    ]);

    // Render the movie.ejs view with movie and categoryCounts data
    res.render('movie', { movie, categoryCounts });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

module.exports = router;