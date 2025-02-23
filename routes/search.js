// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { q, minRating, category, contentType, genre, sort, lang } = req.query;

  // Default to en-US
  const language = lang || 'en-US';
  const originalLang = language.split('-')[0]; // e.g. 'en'

  // local DB filter
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

    // if user typed a query => search
    // else if only genre => discover
    if (q && q.trim() !== '') {
      // SEARCH calls
      if (contentType === 'TV') {
        const tvSearch = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let resp = await axios.get(tvSearch);
        tmdbResults = resp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
        // local filter out non-english if user wants strictly en
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      } else if (contentType === 'Kids') {
        const kidsSearch = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let resp = await axios.get(kidsSearch);
        tmdbResults = resp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      } else {
        // default => search/movie
        const movSearch = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let resp = await axios.get(movSearch);
        tmdbResults = resp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      }
    } else if (genre) {
      // no q => discover with genre
      if (contentType === 'TV') {
        // discover tv
        let tvDisc = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        // if user wants strictly en => add &with_original_language=en
        if (originalLang === 'en') {
          tvDisc += `&with_original_language=en`;
        }
        let resp = await axios.get(tvDisc);
        tmdbResults = resp.data.results || [];
      } else if (contentType === 'Kids') {
        // discover movie with kids logic
        let kidsDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          kidsDisc += `&with_original_language=en`;
        }
        let resp = await axios.get(kidsDisc);
        tmdbResults = resp.data.results || [];
      } else {
        // discover movie
        let movDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          movDisc += `&with_original_language=en`;
        }
        let resp = await axios.get(movDisc);
        tmdbResults = resp.data.results || [];
      }
    } else {
      // user just visited /search with no q or genre => do nothing
    }

    // upsert
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
        if (!finalResults.find(r => r._id.equals(found._id))) {
          finalResults.push(found);
        }
      }
    }

    // sorting
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
