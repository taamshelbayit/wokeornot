// routes/sitemap.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
  try {
    // In a real app, you'd fetch all relevant URLs: movies, forum pages, blog posts, etc.
    const movies = await Movie.find({}).select('_id updatedAt');

    // Basic XML structure
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Homepage
    xml += `  <url>\n    <loc>https://${req.headers.host}/</loc>\n    <changefreq>daily</changefreq>\n  </url>\n`;

    // Movies
    movies.forEach(m => {
      xml += `  <url>\n    <loc>https://${req.headers.host}/movies/${m._id}</loc>\n    <lastmod>${m.updatedAt.toISOString()}</lastmod>\n  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
