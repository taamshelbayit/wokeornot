// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { q, minRating, category, contentType, genre, sort } = req.query;

  // 1) Local DB filter
  let localQuery = {};

  if (contentType && ['Movie', 'TV', 'Kids'].includes(contentType)) {
    localQuery.contentType = contentType;
  }
  if (minRating) {
    localQuery.averageRating = { $gte: parseFloat(minRating) };
  }
  if (category && category.trim() !== '') {
    const fieldName = `wokeCategoryCounts.${category}`;
    localQuery[fieldName] = { $gt: 0 };
  }
  if (q && q.trim() !== '') {
    // partial match in local DB
    localQuery.title = { $regex: q.trim(), $options: 'i' };
  }

  try {
    // local DB results
    let localResults = await Movie.find(localQuery).limit(200);

    // We'll unify them in finalResults
    let finalResults = [...localResults];

    // 2) TMDb logic
    const apiKey = process.env.TMDB_API_KEY;
    let tmdbResults = [];

    // a) If user typed a query => do /search/tv or /search/movie
    // b) If user only has genre => do /discover
    // c) If user has both q + genre => do direct search then filter by genre locally
    //    or do two calls and intersect. We'll pick a simpler approach below.

    if (q && q.trim() !== '') {
      // user typed a title => do search
      if (contentType === 'TV') {
        // search/tv
        let tvResp = await axios.get(
          `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(q.trim())}&language=en-US&page=1`
        );
        tmdbResults = tvResp.data.results || [];
      } else if (contentType === 'Kids') {
        // we can still do search/movie for kids
        let kidsResp = await axios.get(
          `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q.trim())}&language=en-US&page=1`
        );
        tmdbResults = kidsResp.data.results || [];
      } else {
        // default => search/movie
        let movieResp = await axios.get(
          `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q.trim())}&language=en-US&page=1`
        );
        tmdbResults = movieResp.data.results || [];
      }

      // optional: if user also selected a genre, we can filter the search results by that genre ID
      if (genre) {
        tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
      }

    } else if (genre) {
      // user didn't type a q, but picked a genre => do discover
      if (contentType === 'TV') {
        let tvDiscover = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        let tvResp = await axios.get(tvDiscover);
        tmdbResults = tvResp.data.results || [];
      } else if (contentType === 'Kids') {
        // discover movie with kids
        let kidsDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        let kidsResp = await axios.get(kidsDiscover);
        tmdbResults = kidsResp.data.results || [];
      } else {
        // default => discover movie
        let movDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        let movResp = await axios.get(movDiscover);
        tmdbResults = movResp.data.results || [];
      }
    }

    // 3) Upsert TMDb results
    for (let item of tmdbResults) {
      let found = await Movie.findOne({ tmdbId: item.id.toString() });
      if (!found) {
        let title = item.title || item.name || 'Untitled';
        let releaseDate = item.release_date || item.first_air_date;
        let posterPath = item.poster_path;
        let description = item.overview || '';
        let newDoc = new Movie({
          title,
          tmdbId: item.id.toString(),
          description,
          releaseDate,
          posterPath,
          contentType: contentType || 'Movie'
        });
        await newDoc.save();
        finalResults.push(newDoc);
      } else {
        // already in DB => optionally push to finalResults if not already
        if (!finalResults.find(r => r._id.equals(found._id))) {
          finalResults.push(found);
        }
      }
    }

    // 4) Sorting
    if (sort === 'ratingDesc') {
      finalResults.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (sort === 'notWokeDesc') {
      finalResults.sort((a, b) => (b.notWokeCount || 0) - (a.notWokeCount || 0));
    }

    // 5) Filter out duplicates
    let uniqueMap = new Map();
    let uniqueResults = [];
    for (let r of finalResults) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // limit final display
    uniqueResults = uniqueResults.slice(0, 100);

    res.render('search', { results: uniqueResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
