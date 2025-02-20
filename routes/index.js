// routes/index.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Render the homepage (index.ejs)
  res.render('index');
});

module.exports = router;
