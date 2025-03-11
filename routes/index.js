// routes/index.js
const express = require("express");
const router = express.Router();
const Movie = require("../models/Movie"); // Ensure this model exists

// GET Homepage
router.get("/", async (req, res) => {
  try {
    console.log("Fetching top woke movies...");

    // Fetch the top 5 most woke movies
    const topWokeMovies = await Movie.find().sort({ averageRating: -1 }).limit(5);

    // Fetch the top 5 least woke movies
    const topNotWokeMovies = await Movie.find().sort({ notWokeCount: -1 }).limit(5);

    res.render("index", {
      pageTitle: "WokeOrNot - Rate Movies & TV Shows",
      topWokeMovies,
      topNotWokeMovies,
    });

  } catch (error) {
    console.error("Error fetching homepage data:", error);
    res.render("index", {
      pageTitle: "WokeOrNot - Rate Movies & TV Shows",
      topWokeMovies: [],
      topNotWokeMovies: [],
    });
  }
});

module.exports = router;
