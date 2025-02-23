// routes/movies.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
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
        // search/tv
        const tvSearchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const tvResp = await axios.get(tvSearchUrl);
        tmdbResults = tvResp.data.results || [];
        // if genre also given, filter results by that genre ID
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      } else if (contentType === 'Kids') {
        // search/movie
        const kidsSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}`;
        const kidsResp = await axios.get(kidsSearchUrl);
        tmdbResults = kidsResp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
      } else {
        // default => search/movie
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
        // discover movie
        let kidsDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const kdResp = await axios.get(kidsDiscover);
        tmdbResults = kdResp.data.results || [];
      } else {
        // default => discover movie
        const movDiscover = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${genre}`;
        const mdResp = await axios.get(movDiscover);
        tmdbResults = mdResp.data.results || [];
      }
    } else {
      // user just visited /movies => maybe show local DB items or do a default discover?
      // For now, let's do nothing special. We'll show local DB items below.
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

    // 3) Also fetch local DB items for contentType
    // If user typed q => we can do a local filter
    let dbQuery = { contentType };
    // If you want partial local filtering by q => dbQuery.title = ...
    // but let's keep it simple
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

    // Finally render "list.ejs"
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
      // fetch from TMDb
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
    // redirect to detail page
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

    // If you want to pass wokeCategories or categoryCounts:
    const categoryCounts = [];
    for (let [cat, count] of movie.wokeCategoryCounts) {
      categoryCounts.push({ category: cat, count });
    }

    res.render('movie', { movie, categoryCounts });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

module.exports = router;
