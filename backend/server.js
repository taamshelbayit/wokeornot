const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB with error handling
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ MongoDB Connected!");
    
    // Start the server only after the database is connected
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1); // Stop the app if DB connection fails
  });

// Define a Movie Schema
const movieSchema = new mongoose.Schema({
  title: String,
  wokeScore: Number,
  description: String,
});

const Movie = mongoose.model("Movie", movieSchema);

// ✅ Create a movie entry (POST /api/movies)
app.post("/api/movies", async (req, res) => {
  try {
    console.log("Incoming request body:", req.body);
    const { title, wokeScore, description } = req.body;

    if (!title || wokeScore === undefined || !description) {
      console.log("❌ Missing fields:", req.body);
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newMovie = new Movie({ title, wokeScore, description });
    await newMovie.save();
    res.status(201).json(newMovie);
  } catch (error) {
    console.error("❌ Error adding movie:", error);
    res.status(500).json({ error: "Failed to add movie", details: error.message });
  }
});

