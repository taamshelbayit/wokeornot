// routes/index.js
const express = require("express");
const router = express.Router();
const Movie = require("../models/Movie");
const TVShow = require("../models/TVShow"); // Ensure this model exists

// GET Homepage
router.get("/", async (req, res) => {
  try {
    console.log("Fetching top content...");

    // Fetch the top 5 most woke movies
    const topWokeMovies = await Movie.find().sort({ averageRating: -1 }).limit(5);

    // Fetch the top 5 least woke movies
    const topNotWokeMovies = await Movie.find().sort({ notWokeCount: -1 }).limit(5);

    // Fetch the top 5 most woke TV shows
    const topWokeShows = await TVShow.find().sort({ averageRating: -1 }).limit(5);

    res.render("index", {
      pageTitle: "WokeOrNot - Rate Movies & TV Shows",
      topWokeMovies,
      topNotWokeMovies,
      topWokeShows,
    });

  } catch (error) {
    console.error("Error fetching homepage data:", error);
    res.render("index", {
      pageTitle: "WokeOrNot - Rate Movies & TV Shows",
      topWokeMovies: [],
      topNotWokeMovies: [],
      topWokeShows: [],
    });
  }
});

module.exports = router;
