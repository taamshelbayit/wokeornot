const API_URL = process.env.BACKEND_URL || "http://localhost:5000"; // Use local server if not deployed

export const getMovies = async () => {
  const response = await fetch(`${API_URL}/api/movies`);
  return response.json();
};

export const rateMovie = async (movieId, rating, justification) => {
  const response = await fetch(`${API_URL}/api/movies/${movieId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating, justification }),
  });
  return response.json();
};
