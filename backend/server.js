const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Define a Movie Schema
const movieSchema = new mongoose.Schema({
  title: String,
  wokeScore: Number,
  description: String,
});

const Movie = mongoose.model("Movie", movieSchema);

// ✅ Create a test movie route (GET /api/movies)
app.get("/api/movies", async (req, res) => {
  try {
    const movies = await Movie.find(); // Fetch all movies from MongoDB
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch movies" });
  }
});

// ✅ Create a test movie entry (POST /api/movies)
app.post("/api/movies", async (req, res) => {
  try {
    const { title, wokeScore, description } = req.body;
    const newMovie = new Movie({ title, wokeScore, description });
    await newMovie.save();
    res.status(201).json(newMovie);
  } catch (error) {
    res.status(500).json({ error: "Failed to add movie" });
  }
});

// Start the server
const PORT = process.env.PORT || 10000; // Ensure it's listening on the correct port
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

