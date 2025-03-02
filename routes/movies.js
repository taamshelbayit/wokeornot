// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const Review = require('../models/Review'); // For category aggregation
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /movies
 *   Supports ?type=Movie|TV|Kids & ?genre=XX & optional q=title
 *   Also supports ?page=N for “Load More” pagination.
 */
router.get('/', async (req, res) => {
  try {
    const { type, genre, q, page } = req.query;
    const contentType = type || 'Movie';

    // For simple “Load More”
    const limit = 12; // # items per page
    const currentPage = parseInt(page, 10) || 1;
    const skip = (currentPage - 1) * limit;

    const apiKey = process.env.TMDB_API_KEY;
    let tmdbResults = [];

    // Decide if user typed a q => search, else if genre => discover, else local only
    if (q && q.trim() !== '') {
      // Searching on TMDb
      if (contentType === 'TV') {
        const tvSearchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const tvResp = await axios.get(tvSearchUrl);
        tmdbResults = tvResp.data.results || [];

        // If genre is given, filter out items that do not have that genre
        if (genre) {
          tmdbResults = tmdbResults.filter(r =>
            Array.isArray(r.genre_ids) && r.genre_ids.includes(parseInt(genre))
          );
        }
      } else if (contentType === 'Kids') {
        const kidsSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const kidsResp = await axios.get(kidsSearchUrl);
        tmdbResults = kidsResp.data.results || [];

        if (genre) {
          tmdbResults = tmdbResults.filter(r =>
            Array.isArray(r.genre_ids) && r.genre_ids.includes(parseInt(genre))
          );
        }
      } else {
        // default to Movie
        const movSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const movResp = await axios.get(movSearchUrl);
        tmdbResults = movResp.data.results || [];

        if (genre) {
          tmdbResults = tmdbResults.filter(r =>
            Array.isArray(r.genre_ids) && r.genre_ids.includes(parseInt(genre))
          );
        }
      }
    } else if (genre) {
      // user only picked a genre => discover
      if (contentType === 'TV') {
        const tvDiscover = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const tvResp = await axios.get(tvDiscover);
        tmdbResults = tvResp.data.results || [];
      } else if (contentType === 'Kids') {
        const kidsDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const kdResp = await axios.get(kidsDiscover);
        tmdbResults = kdResp.data.results || [];
      } else {
        // default to Movie discover
        const movDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const mdResp = await axios.get(movDiscover);
        tmdbResults = mdResp.data.results || [];
      }
    } else {
      // user just visited /movies => local DB only (no external fetch)
    }

    // 2) Upsert each item from tmdbResults into local DB
    let finalList = [];
    for (let item of tmdbResults) {
      const tmdbId = item.id.toString();
      let found = await Movie.findOne({ tmdbId });
      if (!found) {
        const title = item.title || item.name || 'Untitled';
        const releaseDate = item.release_date || item.first_air_date;
        const posterPath = item.poster_path;
        const description = item.overview || '';
        const popularity = item.popularity || 0;

        let newDoc = new Movie({
          title,
          tmdbId,
          description,
          releaseDate,
          posterPath,
          contentType,
          popularity
        });
        await newDoc.save();
        finalList.push(newDoc);
      } else {
        finalList.push(found);
      }
    }

    // 3) Also fetch local DB items for contentType
    let dbQuery = { contentType };
    // If you also want to filter local DB by a q or genre, you need logic here
    // but since local DB items don’t store “genre_ids”, we can’t do local filtering by genre
    // or do partial text search for q. (You could add fields if you want.)

    let localDBItems = await Movie.find(dbQuery)
      .sort({ averageRating: -1 }) // or popularity desc, up to you
      .limit(200); // some upper limit

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

    // 4) Sort them. You could choose to sort by averageRating desc, or popularity, or both.
    // For simplicity, let's do averageRating desc, fallback popularity
    uniqueResults.sort((a, b) => {
      // if both have rating
      if (b.ratings && b.ratings.length > 0 && a.ratings && a.ratings.length > 0) {
        return (b.averageRating || 0) - (a.averageRating || 0);
      }
      // else fallback popularity
      return (b.popularity || 0) - (a.popularity || 0);
    });

    // 5) Pagination (Load More style)
    const total = uniqueResults.length;
    const results = uniqueResults.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    // If the request is AJAX, return JSON
    if (req.xhr) {
      return res.json({
        items: results,
        currentPage,
        totalPages,
        totalCount: total
      });
    }

    // else normal HTML
    res.render('list', {
      movies: results,
      contentType,
      currentPage,
      totalPages,
      totalCount: total
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching items');
    res.redirect('/');
  }
});

/**
 * GET /movies/add?tmdbId=...
 * Upsert from TMDb. Must be defined BEFORE /:id
 */
router.get('/add', ensureAuthenticated, async (req, res) => {
  try {
    const { tmdbId } = req.query;
    if (!tmdbId) {
      req.flash('error_msg', 'No TMDb ID provided.');
      return res.redirect('/');
    }

    let movie = await Movie.findOne({ tmdbId });
    if (movie) {
      return res.redirect(`/movies/${movie._id}`);
    }

    const apiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=en-US`
    );
    const data = response.data;

    movie = new Movie({
      title: data.title || data.name || 'Untitled',
      tmdbId,
      description: data.overview,
      releaseDate: data.release_date || data.first_air_date,
      posterPath: data.poster_path,
      contentType: 'Movie',
      popularity: data.popularity || 0
    });
    await movie.save();

    req.flash('success_msg', 'Movie added successfully!');
    res.redirect(`/movies/${movie._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding movie');
    res.redirect('/');
  }
});

/**
 * GET /movies/trending/:tmdbId => upsert from trending
 */
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
        contentType: 'Movie',
        popularity: data.popularity || 0
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

/**
 * GET /movies/:id => detail page
 */
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
      { $match: { movie: movie._id } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } }
    ]);

    res.render('movie', { movie, categoryCounts });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

module.exports = router;
