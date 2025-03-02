// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const Review = require('../models/Review'); // if you do category stats
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /movies
 *   ?type=Movie|TV|Kids
 *   ?genre=XX
 *   ?q=title
 *   ?page=N  (for pagination)
 */
router.get('/', async (req, res) => {
  try {
    const { type, genre, q, page } = req.query;
    const contentType = type || 'Movie';

    // "Load More" or basic pagination
    const limit = 12; // how many items per page
    const currentPage = parseInt(page, 10) || 1;
    const skip = (currentPage - 1) * limit;

    const apiKey = process.env.TMDB_API_KEY;
    let tmdbResults = [];

    /********************************************************************
     * 1) Decide if we fetch from TMDb or not:
     *    - If user has q or genre => fetch from TMDb
     *    - else => local DB only
     ********************************************************************/
    if ((q && q.trim() !== '') || genre) {
      // User provided either a search q or a genre => do TMDb fetch

      // We'll handle "contentType === 'TV'" vs "Kids" vs default "Movie"
      if (q && q.trim() !== '') {
        // user typed a search query
        if (contentType === 'TV') {
          const tvSearchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
          const tvResp = await axios.get(tvSearchUrl);
          tmdbResults = tvResp.data.results || [];

          if (genre) {
            // numeric genre => filter
            tmdbResults = tmdbResults.filter(r =>
              Array.isArray(r.genre_ids) &&
              r.genre_ids.includes(parseInt(genre))
            );
          }
        } else if (contentType === 'Kids') {
          // searching in "movies" but we label them "Kids"
          const kidsSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
          const kidsResp = await axios.get(kidsSearchUrl);
          tmdbResults = kidsResp.data.results || [];

          if (genre) {
            tmdbResults = tmdbResults.filter(r =>
              Array.isArray(r.genre_ids) &&
              r.genre_ids.includes(parseInt(genre))
            );
          }
        } else {
          // default to searching movies
          const movSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
          const movResp = await axios.get(movSearchUrl);
          tmdbResults = movResp.data.results || [];

          if (genre) {
            tmdbResults = tmdbResults.filter(r =>
              Array.isArray(r.genre_ids) &&
              r.genre_ids.includes(parseInt(genre))
            );
          }
        }
      }
      else if (genre) {
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

    } else {
      // no q, no genre => local DB only => skip TMDb fetch
    }

    /********************************************************************
     * 2) Upsert TMDb items (if we have any in tmdbResults)
     ********************************************************************/
    let finalList = [];
    if (tmdbResults.length > 0) {
      for (let item of tmdbResults) {
        const tmdbId = item.id.toString();
        let found = await Movie.findOne({ tmdbId });
        if (!found) {
          // create new doc
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
    }

    /********************************************************************
     * 3) Decide which items to show:
     *    - If tmdbResults > 0 => show ONLY those items
     *    - else => local DB items
     ********************************************************************/
    let allItems = [];
    if (tmdbResults.length > 0) {
      // user is searching or picking a genre => show only these new items
      allItems = finalList;
    } else {
      // no q, no genre => local DB only
      let dbQuery = { contentType };
      let localDBItems = await Movie.find(dbQuery)
        .sort({ averageRating: -1 })
        .limit(200);

      allItems = localDBItems;
    }

    // remove duplicates
    let uniqueMap = new Map();
    let uniqueResults = [];
    for (let r of allItems) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    /********************************************************************
     * 4) Sort them => rating desc, fallback popularity
     ********************************************************************/
    uniqueResults.sort((a, b) => {
      const aHasRating = (a.ratings && a.ratings.length > 0);
      const bHasRating = (b.ratings && b.ratings.length > 0);

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

    /********************************************************************
     * 5) Pagination
     ********************************************************************/
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
 * GET /movies/add?tmdbId=...
 * Upsert from TMDb
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

    // e.g. categoryCounts for woke categories
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
