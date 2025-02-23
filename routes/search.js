// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const { q, minRating, category, contentType, genre, sort, lang } = req.query;

  // default to en-US
  const language = lang || 'en-US';
  const originalLang = language.split('-')[0]; // e.g. 'en'

  // local DB filter
  let localQuery = {};

  // If contentType is one of Movie, TV, Kids. If "Any" or blank => no local filter on contentType
  const validTypes = ['Movie', 'TV', 'Kids'];
  let finalContentType = (contentType && validTypes.includes(contentType)) ? contentType : null;

  if (finalContentType) {
    localQuery.contentType = finalContentType;
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
    // 1) local DB
    let localResults = await Movie.find(localQuery).limit(200);
    let finalResults = [...localResults];

    // We'll unify TMDb calls into an array tmdbResults, then upsert them
    let tmdbResults = [];

    const apiKey = process.env.TMDB_API_KEY;

    // 2) If user typed q => we do "search" calls
    // If only genre => we do "discover" calls
    // If user typed q AND has "Any" type => we do search for BOTH /search/movie and /search/tv
    if (q && q.trim() !== '') {
      if (!finalContentType) {
        // contentType is "Any" => do both /search/movie and /search/tv
        let [movResp, tvResp] = await Promise.all([
          axios.get(
            `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`
          ),
          axios.get(
            `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`
          )
        ]);
        let movieRes = movResp.data.results || [];
        let tvRes = tvResp.data.results || [];
        // local filter out non-English if user wants strictly en
        movieRes = movieRes.filter(r => r.original_language === originalLang);
        tvRes = tvRes.filter(r => r.original_language === originalLang);

        // If user provided a genre, we can filter each set
        if (genre) {
          const genreNum = parseInt(genre);
          movieRes = movieRes.filter(r => r.genre_ids.includes(genreNum));
          tvRes = tvRes.filter(r => r.genre_ids.includes(genreNum));
        }

        tmdbResults = [...movieRes, ...tvRes];
      } else if (finalContentType === 'TV') {
        // search/tv
        const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let resp = await axios.get(tvUrl);
        tmdbResults = resp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      } else if (finalContentType === 'Kids') {
        // search/movie
        const kidsUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let resp = await axios.get(kidsUrl);
        tmdbResults = resp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      } else {
        // finalContentType === 'Movie'
        const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let resp = await axios.get(movUrl);
        tmdbResults = resp.data.results || [];
        if (genre) {
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(parseInt(genre)));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      }
    } else if (genre) {
      // user only picked a genre => do discover
      if (!finalContentType) {
        // "Any" => do discover for both tv & movie
        let [movDiscResp, tvDiscResp] = await Promise.all([
          axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1${originalLang === 'en' ? '&with_original_language=en' : ''}`),
          axios.get(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1${originalLang === 'en' ? '&with_original_language=en' : ''}`)
        ]);
        let movDisc = movDiscResp.data.results || [];
        let tvDisc = tvDiscResp.data.results || [];
        tmdbResults = [...movDisc, ...tvDisc];
      } else if (finalContentType === 'TV') {
        let tvDiscover = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          tvDiscover += `&with_original_language=en`;
        }
        let resp = await axios.get(tvDiscover);
        tmdbResults = resp.data.results || [];
      } else if (finalContentType === 'Kids') {
        let kidsDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          kidsDisc += `&with_original_language=en`;
        }
        let resp = await axios.get(kidsDisc);
        tmdbResults = resp.data.results || [];
      } else {
        // finalContentType === 'Movie'
        let movDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          movDisc += `&with_original_language=en`;
        }
        let resp = await axios.get(movDisc);
        tmdbResults = resp.data.results || [];
      }
    } else {
      // user didn't type q or genre => do nothing special
    }

    // 2) Upsert results
    for (let item of tmdbResults) {
      let found = await Movie.findOne({ tmdbId: item.id.toString() });
      if (!found) {
        const title = item.title || item.name || 'Untitled';
        const releaseDate = item.release_date || item.first_air_date;
        const posterPath = item.poster_path;
        const description = item.overview || '';
        let ct = 'Movie';
        if (finalContentType) {
          ct = finalContentType;
        } else {
          // If we are "Any" and item.media_type is "tv", let's store as "TV"
          // or "movie" => store as "Movie"
          if (item.media_type === 'tv') {
            ct = 'TV';
          }
        }
        let newDoc = new Movie({
          title,
          tmdbId: item.id.toString(),
          description,
          releaseDate,
          posterPath,
          contentType: ct
        });
        await newDoc.save();
        finalResults.push(newDoc);
      } else {
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
