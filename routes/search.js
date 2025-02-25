// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  const {
    q,
    minRating,
    category,
    contentType,
    genre,
    sort,
    lang,
    notWokeOnly
  } = req.query;

  // default language to en-US
  const language = lang || 'en-US';
  const originalLang = language.split('-')[0]; // e.g. "en"

  // local DB filter
  let localQuery = {};

  // contentType => "Movie", "TV", "Kids", or "Any" (blank)
  const validTypes = ['Movie', 'TV', 'Kids'];
  let finalContentType = null;
  if (contentType && validTypes.includes(contentType)) {
    finalContentType = contentType;
    localQuery.contentType = finalContentType;
  }

  // minRating => localQuery.averageRating >= minRating
  if (minRating) {
    localQuery.averageRating = { $gte: parseFloat(minRating) };
  }

  // category => wokeCategoryCounts.category > 0
  if (category && category.trim() !== '') {
    const fieldName = `wokeCategoryCounts.${category}`;
    localQuery[fieldName] = { $gt: 0 };
  }

  // title partial match
  if (q && q.trim() !== '') {
    localQuery.title = { $regex: q.trim(), $options: 'i' };
  }

  try {
    // 1) local DB search
    let localResults = await Movie.find(localQuery).limit(200);
    let finalResults = [...localResults];

    // 2) TMDb calls
    let tmdbResults = [];
    const apiKey = process.env.TMDB_API_KEY;

    // if user typed q => search calls
    // else if only genre => discover
    // if "Any" => do both movie & tv calls, else do 1 call

    if (q && q.trim() !== '') {
      // typed a title => search
      if (!finalContentType) {
        // contentType is "Any" => do both /search/movie & /search/tv
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

        // filter out non-English if you want strictly originalLang
        movieRes = movieRes.filter(r => r.original_language === originalLang);
        tvRes = tvRes.filter(r => r.original_language === originalLang);

        // if user also picks a genre, filter by r.genre_ids
        if (genre) {
          const g = parseInt(genre);
          movieRes = movieRes.filter(r => r.genre_ids.includes(g));
          tvRes = tvRes.filter(r => r.genre_ids.includes(g));
        }

        tmdbResults = [...movieRes, ...tvRes];
      } else if (finalContentType === 'TV') {
        // /search/tv
        let tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let tvResp = await axios.get(tvUrl);
        tmdbResults = tvResp.data.results || [];

        if (genre) {
          const g = parseInt(genre);
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(g));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      } else if (finalContentType === 'Kids') {
        // /search/movie
        let kidsUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let kidsResp = await axios.get(kidsUrl);
        tmdbResults = kidsResp.data.results || [];

        if (genre) {
          const g = parseInt(genre);
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(g));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      } else {
        // finalContentType === 'Movie'
        let movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(q.trim())}&page=1`;
        let movResp = await axios.get(movUrl);
        tmdbResults = movResp.data.results || [];

        if (genre) {
          const g = parseInt(genre);
          tmdbResults = tmdbResults.filter(r => r.genre_ids.includes(g));
        }
        tmdbResults = tmdbResults.filter(r => r.original_language === originalLang);
      }
    } else if (genre) {
      // user only picked a genre => discover
      if (!finalContentType) {
        // "Any" => discover movie + tv
        let [movDiscResp, tvDiscResp] = await Promise.all([
          axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1${originalLang === 'en' ? '&with_original_language=en' : ''}`),
          axios.get(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1${originalLang === 'en' ? '&with_original_language=en' : ''}`)
        ]);
        let movDisc = movDiscResp.data.results || [];
        let tvDisc = tvDiscResp.data.results || [];
        tmdbResults = [...movDisc, ...tvDisc];
      } else if (finalContentType === 'TV') {
        let tvDisc = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          tvDisc += `&with_original_language=en`;
        }
        let tvResp = await axios.get(tvDisc);
        tmdbResults = tvResp.data.results || [];
      } else if (finalContentType === 'Kids') {
        let kidsDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          kidsDisc += `&with_original_language=en`;
        }
        let kdResp = await axios.get(kidsDisc);
        tmdbResults = kdResp.data.results || [];
      } else {
        // finalContentType === 'Movie'
        let movDisc = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=${language}&sort_by=popularity.desc&with_genres=${genre}&page=1`;
        if (originalLang === 'en') {
          movDisc += `&with_original_language=en`;
        }
        let mdResp = await axios.get(movDisc);
        tmdbResults = mdResp.data.results || [];
      }
    }
    // else => user didn't type q or pick a genre => no external fetch

    // 3) Upsert tmdbResults
    for (let item of tmdbResults) {
      let found = await Movie.findOne({ tmdbId: item.id.toString() });
      if (!found) {
        let title = item.title || item.name || 'Untitled';
        let releaseDate = item.release_date || item.first_air_date;
        let posterPath = item.poster_path;
        let description = item.overview || '';

        // default to 'Movie' unless we detect tv
        let ct = 'Movie';
        if (finalContentType) {
          ct = finalContentType;
        } else if (item.media_type === 'tv') {
          ct = 'TV';
        }
        // if user wants Kids, you might set ct='Kids' or detect if it's family/animation

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
        // if not in finalResults, push it
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

    // 5) If user checked "Not Woke Only," filter out items with notWokeCount=0
    if (notWokeOnly === 'on') {
      finalResults = finalResults.filter(item => (item.notWokeCount || 0) > 0);
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

    // render
    res.render('search', { results: uniqueResults });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Search error');
    res.redirect('/');
  }
});

module.exports = router;
