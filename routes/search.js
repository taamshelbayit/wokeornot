// routes/search.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Movie = require('../models/Movie');
const { ensureAuthenticated } = require('../utils/auth');

/**
 * GET /search
 *  - If no `q`, we can do advanced local-only search (via query params),
 *    or show a form if you prefer.
 *  - If `q` present => merges local DB + TMDb results, then applies filters & sorting.
 *  - Supports ?page=1..N, ?sort=ratingDesc|popularity|releaseDate|title|notWokeDesc
 *  - Supports ?contentType=Movie|TV|Kids, ?minRating=..., ?maxRating=..., ?category=..., ?notWokeOnly=on
 *  - If AJAX => return JSON for “Load More”
 */
router.get('/', async (req, res) => {
  try {
    // Extract query params
    const {
      q = '',               // partial title
      page = 1,             // pagination
      sort = 'ratingDesc',  // sort param
      contentType,          // e.g. "Movie", "TV", "Kids"
      minRating,            // e.g. "5"
      maxRating,            // e.g. "9"
      category,             // e.g. "Transgender Themes"
      notWokeOnly           // "on" if checkbox
      // If you store genre in an array => ?genre=...
    } = req.query;

    const currentPage = parseInt(page, 10) || 1;
    const limit = 12;
    const skip = (currentPage - 1) * limit;

    // If no search query => optional advanced local search
    // or just render a form. Let's show a form:
    if (!q.trim()) {
      // If you want to do advanced local-only searching with query params,
      // you can handle that logic here. For now, let's just show the form.
      return res.render('search'); // e.g. your advanced search form
    }

    // 1) We do the local DB search for partial matches on title
    const localResults = await Movie.find({
      title: { $regex: q.trim(), $options: 'i' }
    });

    // 2) Also fetch from TMDb if q is present
    const apiKey = process.env.TMDB_API_KEY;
    const [movResp, tvResp] = await Promise.all([
      axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}&page=1`
      ),
      axios.get(
        `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(q.trim())}&page=1`
      )
    ]);
    let tmdbMovies = movResp.data.results || [];
    let tmdbTV = tvResp.data.results || [];
    let tmdbCombined = [...tmdbMovies, ...tmdbTV];

    // 3) Merge local + TMDb (upsert into DB)
    let finalResults = [...localResults];
    for (let item of tmdbCombined) {
      const tmdbId = item.id.toString();
      let found = await Movie.findOne({ tmdbId });
      if (!found) {
        let newDoc = new Movie({
          title: item.title || item.name || 'Untitled',
          tmdbId,
          description: item.overview || '',
          releaseDate: item.release_date || item.first_air_date,
          posterPath: item.poster_path || '',
          contentType: item.media_type === 'tv' ? 'TV' : 'Movie',
          popularity: item.popularity || 0
        });
        await newDoc.save();
        finalResults.push(newDoc);
      } else {
        // If found is not already in finalResults, push it
        if (!finalResults.find(r => r._id.equals(found._id))) {
          finalResults.push(found);
        }
      }
    }

    // 4) Remove duplicates
    const uniqueMap = new Map();
    const uniqueResults = [];
    for (let r of finalResults) {
      if (!uniqueMap.has(r._id.toString())) {
        uniqueMap.set(r._id.toString(), true);
        uniqueResults.push(r);
      }
    }

    // 5) Now apply advanced filters locally

    // Filter by contentType
    let filtered = uniqueResults;
    if (contentType && contentType.trim()) {
      filtered = filtered.filter(m => m.contentType === contentType);
    }

    // Filter by notWokeOnly
    if (notWokeOnly === 'on') {
      filtered = filtered.filter(m => (m.notWokeCount || 0) > 0);
    }

    // Filter by minRating / maxRating
    if (minRating) {
      const minVal = parseFloat(minRating);
      filtered = filtered.filter(m => (m.averageRating || 0) >= minVal);
    }
    if (maxRating) {
      const maxVal = parseFloat(maxRating);
      filtered = filtered.filter(m => (m.averageRating || 0) <= maxVal);
    }

    // Filter by woke category
    if (category && category.trim()) {
      // if you store categories in wokeCategoryCounts.<cat> = number
      filtered = filtered.filter(m => {
        if (!m.wokeCategoryCounts) return false;
        const count = m.wokeCategoryCounts.get(category) || 0;
        return count > 0;
      });
    }

    // 6) Sort
    filtered = sortResults(filtered, sort);

    // 7) Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const pageResults = filtered.slice(skip, skip + limit);

    // 8) If AJAX => return JSON
    if (req.xhr) {
      return res.json({
        items: pageResults,
        currentPage,
        totalPages,
        totalCount: total
      });
    }

    // 9) else => render search-results.ejs (or whichever)
    res.render('search-results', {
      q,
      results: pageResults,
      currentPage,
      totalPages,
      totalCount: total,
      sortParam: sort
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing search');
    res.redirect('/');
  }
});

/**
 * POST /search
 *  - If you want to keep a separate advanced local-only approach (from your code),
 *    you can keep this. Or you can rely entirely on the GET route above.
 */
router.post('/', async (req, res) => {
  try {
    const { title, minRating, maxRating, notWoke, contentType, sortParam } = req.body;
    let query = {};

    if (contentType) {
      query.contentType = contentType;
    }
    if (title && title.trim() !== '') {
      query.title = { $regex: title.trim(), $options: 'i' };
    }
    if (minRating) {
      query.averageRating = { $gte: parseFloat(minRating) };
    }
    if (maxRating) {
      query.averageRating = query.averageRating || {};
      query.averageRating.$lte = parseFloat(maxRating);
    }
    if (notWoke === 'on') {
      query.notWokeCount = { $gt: 0 };
    }

    let results = await Movie.find(query).limit(500);
    results = sortResults(results, sortParam || 'rating');
    results = results.slice(0, 100);

    res.render('advanced-search-results', { results });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error performing advanced search');
    res.redirect('/');
  }
});

/**
 * POST /search/save => user saves a search query
 */
router.post('/save', ensureAuthenticated, async (req, res) => {
  try {
    const { searchName, queryString } = req.body;
    req.user.savedSearches = req.user.savedSearches || [];
    req.user.savedSearches.push({
      name: searchName,
      query: queryString,
      createdAt: new Date()
    });
    await req.user.save();

    req.flash('success_msg', 'Search saved successfully');
    res.redirect('/search');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error saving search');
    res.redirect('/search');
  }
});

// Helper for sorting
function sortResults(arr, sortParam) {
  switch (sortParam) {
    case 'ratingDesc':
    case 'rating':
      return arr.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    case 'notWokeDesc':
      return arr.sort((a, b) => (b.notWokeCount || 0) - (a.notWokeCount || 0));
    case 'popularity':
      return arr.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    case 'releaseDate':
      return arr.sort((a, b) => {
        let bd = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        let ad = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        return bd - ad;
      });
    case 'title':
      return arr.sort((a, b) => {
        let at = a.title.toLowerCase();
        let bt = b.title.toLowerCase();
        return at.localeCompare(bt);
      });
    default:
      // fallback => ratingDesc
      return arr.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  }
}

module.exports = router;
