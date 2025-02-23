// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { q, minRating, category, contentType, genre, sort, lang } = req.query;

  // default language to en-US
  const language = lang || 'en-US';

  // 1) local DB filter
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
    localQuery.title = { $regex: q.trim(), $options: 'i' };
  }

  try {
    let localResults = await Movie.find(localQuery).limit(200);
    let finalResults = [...localResults];

    const apiKey = process.env.TMDB_API_KEY;
    let tmdbResults = [];

    // If user typed q => do search calls, else if only genre => do discover
    if (q && q.trim() !== '') {
      if (contentType === 'TV') {
        // search/tv
        const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        const tvResp = await axios.get(tvUrl);
        tmdbResults = tvResp.data.results || [];
        // if user also selected genre => filter by genre_ids
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      } else if (contentType === 'Kids') {
        // search/movie
        const kidsUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        const kidsResp = await axios.get(kidsUrl);
        tmdbResults = kidsResp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      } else {
        // default => search/movie
        const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        const movResp = await axios.get(movUrl);
        tmdbResults = movResp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      }
    } else if (genre) {
      // no q => do discover with genre
      if (contentType === 'TV') {
        const tvDiscover = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}`;
        const tvResp = await axios.get(tvDiscover);
        tmdbResults = tvResp.data.results || [];
      } else if (contentType === 'Kids') {
        const kidsDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}`;
        const kdResp = await axios.get(kidsDisc);
        tmdbResults = kdResp.data.results || [];
      } else {
        // discover movie
        const movDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}`;
        const mdResp = await axios.get(movDisc);
        tmdbResults = mdResp.data.results || [];
      }
    }

    // 2) Upsert results
    for (let item of tmdbResults) {
      let found = await Movie.findOne({ tmdbId: item.id.toString() });
      if (!found) {
        const title = item.title || item.name || 'Untitled';
        const releaseDate = item.release_date || item.first_air_date;
        const posterPath = item.poster_path;
        const description = item.overview || '';
        let doc = new Movie({
          title,
          tmdbId: item.id.toString(),
          description,
          releaseDate,
          posterPath,
          contentType: contentType || 'Movie'
        });
        await doc.save();
        finalResults.push(doc);
      } else {
        // if not in finalResults yet, push
        if (!finalResults.find(r => r._id.equals(found._id))) {
          finalResults.push(found);
        }
      }
    }

    // 3) Sorting
    if (sort === 'ratingDesc') {
      finalResults.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (sort === 'notWokeDesc') {
      finalResults.sort((a, b) => (b.notWokeCount || 0) - (a.notWokeCount || 0));
    }

    // remove duplicates
    let uniqueMap = new Map();
    let uniqueResults = [];
    for (let r of finalResults) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // limit final
    uniqueResults = uniqueResults.slice(0, 100);

    res.render('search', { results: uniqueResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
