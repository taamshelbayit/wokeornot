// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /movies
 *  - Supports ?type=Movie|TV|Kids, ?genre=XX, and pagination ?page=1..N
 *  - If genre present => fetch from TMDb discover or search, store genre IDs in local DB
 *  - Filter local DB items by contentType + (if genre) must include that genre in the 'genres' array
 *  - Return JSON if AJAX => "Load More" approach
 */
router.get('/', async (req, res) => {
  try {
    const { type, genre } = req.query;
    const contentType = type || 'Movie';

    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // 1) If user specified a genre => do a TMDb discover
    //    or if user just wants "All Movies" => we do local DB only
    const apiKey = process.env.TMDB_API_KEY;
    let discovered = [];
    if (genre) {
      // fetch from TMDb discover
      // e.g. /discover/movie?with_genres=27 for horror
      // or /discover/tv if contentType=TV
      if (contentType === 'TV') {
        const tvUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        const tvResp = await axios.get(tvUrl);
        discovered = tvResp.data.results || [];
      } else if (contentType === 'Kids') {
        // Kids + genre => discover movie for now
        // or you could do a specialized approach for kids
        const kidsUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        const kdResp = await axios.get(kidsUrl);
        discovered = kdResp.data.results || [];
      } else {
        // default to Movie
        const movUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        const movResp = await axios.get(movUrl);
        discovered = movResp.data.results || [];
      }
    }
    // 2) Upsert discovered items into local DB, storing their TMDb genre_ids in "genres"
    for (let item of discovered) {
      const tmdbId = item.id.toString();
      let found = await Movie.findOne({ tmdbId });
      if (!found) {
        const title = item.title || item.name || 'Untitled';
        const releaseDate = item.release_date || item.first_air_date;
        const posterPath = item.poster_path;
        const description = item.overview || '';
        const popularity = item.popularity || 0;
        const genres = item.genre_ids || []; // store as array of numbers

        let newDoc = new Movie({
          title,
          tmdbId,
          description,
          releaseDate,
          posterPath,
          contentType,
          popularity,
          genres
        });
        await newDoc.save();
      } else {
        // If found, optionally update its genres if not present
        // e.g. if found.genres doesn't include all item.genre_ids
        let changed = false;
        item.genre_ids.forEach(gid => {
          if (!found.genres.includes(gid)) {
            found.genres.push(gid);
            changed = true;
          }
        });
        // also ensure contentType is correct if needed
        if (found.contentType !== contentType) {
          found.contentType = contentType;
          changed = true;
        }
        if (changed) {
          await found.save();
        }
      }
    }

    // 3) Now fetch from local DB
    //    Filter by contentType
    //    If genre => only items that have that genre in their "genres" array
    let query = { contentType };
    if (genre) {
      query.genres = { $in: [parseInt(genre)] };
    }

    // We'll fetch everything, then sort by popularity or averageRating?
    // or we can do a sort by averageRating desc. Up to you.
    // We'll do "popularity" desc for default. You can tweak this.
    let allLocal = await Movie.find(query).sort({ popularity: -1 });

    // 4) Pagination
    const total = allLocal.length;
    const pageResults = allLocal.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    // 5) If AJAX => return JSON for "Load More"
    if (req.xhr) {
      return res.json({
        items: pageResults,
        currentPage: page,
        totalPages,
        totalCount: total
      });
    }

    // 6) Otherwise => render list.ejs
    //    We'll pass contentType, genre, and pagination data
    res.render('list', {
      movies: pageResults,
      contentType,
      genre,
      currentPage: page,
      totalPages,
      totalCount: total,
      limit
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching items');
    res.redirect('/');
  }
});

/**
 * GET /movies/add?tmdbId=...
 *  - Upsert from TMDb for a single item
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
      // Already have it => redirect
      return res.redirect(`/movies/${movie._id}`);
    }

    const apiKey = process.env.TMDB_API_KEY;
    const resp = await axios.get(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=en-US`
    );
    const data = resp.data;

    movie = new Movie({
      title: data.title || data.name || 'Untitled',
      tmdbId,
      description: data.overview,
      releaseDate: data.release_date || data.first_air_date,
      posterPath: data.poster_path,
      contentType: 'Movie',
      popularity: data.popularity || 0,
      genres: data.genres ? data.genres.map(g => g.id) : []
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
        popularity: data.popularity || 0,
        genres: data.genres ? data.genres.map(g => g.id) : []
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
    const Movie = require('../models/Movie');
    const Review = require('../models/Review');

    const movie = await Movie.findById(req.params.id)
      .populate('reviews')
      .populate('forum');
    if (!movie) {
      req.flash('error_msg', 'Movie not found');
      return res.redirect('/');
    }

    // Calculate categoryCounts from reviews
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
