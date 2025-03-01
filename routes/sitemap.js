// routes/sitemap.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');

// GET /sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    const movies = await Movie.find({}).select('_id updatedAt');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    // add homepage
    xml += `<url><loc>https://www.wokeornot.net/</loc><priority>1.0</priority></url>\n`;
    // add each movie
    movies.forEach(m => {
      xml += `<url>
        <loc>https://www.wokeornot.net/movies/${m._id}</loc>
        <lastmod>${m.updatedAt.toISOString()}</lastmod>
        <priority>0.8</priority>
      </url>\n`;
    });
    xml += `</urlset>`;
    res.type('application/xml');
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
