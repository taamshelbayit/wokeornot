// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const Review = require('../models/Review'); // for category stats, if needed
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /movies
 *   Query params:
 *   - ?type=Movie|TV|Kids
 *   - ?genre=XX (TMDb numeric genre ID)
 *   - ?q=title (search string)
 *   - ?page=N  (for pagination)
 *
 * Steps:
 * 1) If user typed q or picked genre => fetch from TMDb
 * 2) Upsert those items into local DB
 * 3) Also fetch local DB items for the given contentType
 * 4) Merge everything, remove duplicates
 * 5) Sort by averageRating desc, fallback popularity desc
 * 6) Paginate with limit=12
 * 7) If AJAX => return JSON, else render list.ejs
 */
router.get('/', async (req, res) => {
  try {
    const { type, genre, q, page } = req.query;
    const contentType = type || 'Movie';

    // "Load More" style pagination
    const limit = 12;
    const currentPage = parseInt(page, 10) || 1;
    const skip = (currentPage - 1) * limit;

    const apiKey = process.env.TMDB_API_KEY;
    let tmdbResults = [];

    // 1) Possibly fetch from TMDb if q or genre is provided
    if ((q && q.trim() !== '') || genre) {
      // We handle searching vs discover, and contentType
      if (q && q.trim() !== '') {
        // Searching by q
        if (contentType === 'TV') {
          const tvSearchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
          const tvResp = await axios.get(tvSearchUrl);
          tmdbResults = tvResp.data.results || [];

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
          // default: searching Movies
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
      }
    }
    // else => no q, no genre => skip external fetch (local DB only)

    // 2) Upsert any TMDb items
    let finalList = [];
    for (let item of tmdbResults) {
      const tmdbId = item.id.toString();
      let found = await Movie.findOne({ tmdbId });
      if (!found) {
        const title = item.title || item.name || 'Untitled';
        const releaseDate = item.release_date || item.first_air_date;
        const posterPath = item.poster_path || '';
        const description = item.overview || '';
        const popularity = item.popularity || 0;

        const newDoc = new Movie({
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

    // 3) Also fetch local DB items for the given contentType
    let dbQuery = { contentType };
    const localDBItems = await Movie.find(dbQuery)
      .sort({ averageRating: -1 })
      .limit(200);

    // 4) Merge local items + newly upserted
    let allItems = [...localDBItems];
    for (let doc of finalList) {
      if (!allItems.find(d => d._id.equals(doc._id))) {
        allItems.push(doc);
      }
    }

    // remove duplicates
    const uniqueMap = new Map();
    const uniqueResults = [];
    for (let r of allItems) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // 5) Sort => rating desc, fallback popularity
    uniqueResults.sort((a, b) => {
      const aHasRating = a.ratings && a.ratings.length > 0;
      const bHasRating = b.ratings && b.ratings.length > 0;

      if (aHasRating && bHasRating) {
        return (b.averageRating || 0) - (a.averageRating || 0);
      } else if (aHasRating && !bHasRating) {
        return -1;
      } else if (!aHasRating && bHasRating) {
        return 1;
      } else {
        // fallback popularity desc
        return (b.popularity || 0) - (a.popularity || 0);
      }
    });

    // 6) Pagination
    const total = uniqueResults.length;
    const results = uniqueResults.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    // If AJAX => return JSON for “Load More”
    if (req.xhr) {
      return res.json({
        items: results,
        currentPage,
        totalPages,
        totalCount: total
      });
    }

    // else => normal HTML
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
 * GET /movies/add?tmdbId=... => upsert from TMDb
 * Must be defined BEFORE /:id so we don't treat "add" as an :id
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
    try {
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
      return res.redirect(`/movies/${movie._id}`);
    } catch (tmdbErr) {
      // Handle TMDB 404 or other errors gracefully
      if (tmdbErr.response && tmdbErr.response.status === 404) {
        console.log('TMDB 404: invalid ID', tmdbId);
        req.flash('error_msg', 'TMDB could not find this movie');
      } else {
        console.error('TMDB fetch error:', tmdbErr);
        req.flash('error_msg', 'Error fetching from TMDB');
      }
      return res.redirect('/');
    }
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding movie');
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

    // If you want woke category stats or other data from reviews
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

/**
 * POST /movies/rate/:id => add a rating
 */
router.post('/rate/:id', ensureAuthenticated, async (req, res) => {
  try {
    const movieId = req.params.id;
    const { rating } = req.body; // user-submitted rating

    const localMovie = await Movie.findById(movieId);
    if (!localMovie) {
      req.flash('error_msg', 'Movie not found.');
      return res.redirect('/movies');
    }

    // Update local rating data
    localMovie.ratings.push(rating);
    const sum = localMovie.ratings.reduce((acc, val) => acc + Number(val), 0);
    localMovie.averageRating = sum / localMovie.ratings.length;

    await localMovie.save();

    req.flash('success_msg', 'Rating added!');
    res.redirect(`/movies/${movieId}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error rating movie.');
    res.redirect('/movies');
  }
});

module.exports = router;
