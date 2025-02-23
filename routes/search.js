// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

/**
 * GET /search
 * We handle:
 * - q (title)
 * - contentType (Movie, TV, Kids)
 * - minRating
 * - category (wokeCategoryCounts)
 * - genre (TMDb genre ID)
 * - sort (e.g., ratingDesc, notWokeDesc)
 */
router.get('/', async (req, res) => {
  const { q, minRating, category, contentType, genre, sort } = req.query;

  // 1) Build a local DB query
  let localQuery = {};

  // If contentType is one of Movie, TV, Kids, use it
  if (contentType && ['Movie', 'TV', 'Kids'].includes(contentType)) {
    localQuery.contentType = contentType;
  }

  // Filter by minRating
  if (minRating) {
    localQuery.averageRating = { $gte: parseFloat(minRating) };
  }

  // Filter by woke category in wokeCategoryCounts
  if (category && category.trim() !== '') {
    const fieldName = `wokeCategoryCounts.${category}`;
    localQuery[fieldName] = { $gt: 0 };
  }

  // Title partial match in local DB
  if (q && q.trim() !== '') {
    localQuery.title = { $regex: q.trim(), $options: 'i' };
  }

  try {
    // 2) Search local DB
    let localResults = await Movie.find(localQuery).limit(100);

    // 3) Also fetch from TMDb if user typed a query or genre
    let tmdbResults = [];
    if ((q && q.trim() !== '') || genre) {
      const apiKey = process.env.TMDB_API_KEY;

      if (contentType === 'TV') {
        // if we have q, do search/tv
        // if we have genre, do discover/tv
        if (q && !genre) {
          // search tv
          let tvResp = await axios.get(
            `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(q.trim())}`
          );
          tmdbResults = tvResp.data.results || [];
        } else {
          // discover tv
          let tvDiscover = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=en-US`;
          if (genre) {
            tvDiscover += `&with_genres=${genre}`;
          }
          if (q) {
            // There's no direct "with_keywords" for partial title, but let's keep it simple
            tvDiscover += `&query=${encodeURIComponent(q.trim())}`;
          }
          let tvResp = await axios.get(tvDiscover);
          tmdbResults = tvResp.data.results || [];
        }
      } else if (contentType === 'Kids') {
        // Similar logic for kids => discover/movie with family or animation
        // If user typed q => search/movie
        if (q && !genre) {
          let movieResp = await axios.get(
            `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q.trim())}`
          );
          tmdbResults = movieResp.data.results || [];
        } else {
          let discoverKids = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US`;
          if (genre) {
            discoverKids += `&with_genres=${genre}`;
          } else {
            discoverKids += `&with_genres=16,10751`; // default for kids
          }
          if (q) {
            discoverKids += `&query=${encodeURIComponent(q.trim())}`;
          }
          let kidsResp = await axios.get(discoverKids);
          tmdbResults = kidsResp.data.results || [];
        }
      } else {
        // Default => Movie
        if (q && !genre) {
          // search movie
          let movieResp = await axios.get(
            `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q.trim())}`
          );
          tmdbResults = movieResp.data.results || [];
        } else {
          // discover movie
          let discoverMovie = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US`;
          if (genre) {
            discoverMovie += `&with_genres=${genre}`;
          }
          if (q) {
            discoverMovie += `&query=${encodeURIComponent(q.trim())}`;
          }
          let movResp = await axios.get(discoverMovie);
          tmdbResults = movResp.data.results || [];
        }
      }
    }

    // 4) Upsert TMDb results if not in DB
    for (let item of tmdbResults) {
      let found = await Movie.findOne({ tmdbId: item.id.toString() });
      if (!found) {
        let title = item.title || item.name || 'Untitled';
        let releaseDate = item.release_date || item.first_air_date;
        let posterPath = item.poster_path;
        let description = item.overview || '';
        let newMovie = new Movie({
          title,
          tmdbId: item.id.toString(),
          description,
          releaseDate,
          posterPath,
          contentType: contentType || 'Movie'
        });
        await newMovie.save();
        // push to localResults array so it shows up
        localResults.push(newMovie);
      }
    }

    // 5) If user wants sorting => ratingDesc or notWokeDesc
    // We'll apply it to localResults in memory. Or we can re-query.
    if (sort === 'ratingDesc') {
      localResults.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (sort === 'notWokeDesc') {
      localResults.sort((a, b) => (b.notWokeCount || 0) - (a.notWokeCount || 0));
    } else {
      // default sort by _id or something if you want
    }

    // 6) We can limit final results to 100 or so
    let finalResults = localResults.slice(0, 100);

    // 7) Render search.ejs
    res.render('search', { results: finalResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
