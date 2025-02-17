import { useEffect, useState } from "react";
import { getMovies } from "../utils/api";

export default function Home() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    getMovies().then((data) => setMovies(data));
  }, []);

  return (
    <div>
      <h1 className="text-4xl font-bold text-center mt-10">Woke or Not</h1>
      <p className="text-center mt-4">Rate movies and TV shows based on their wokeness.</p>
      
      <div className="grid grid-cols-3 gap-4 p-4">
        {movies.map((movie) => (
          <div key={movie._id} className="border p-4 rounded-lg">
            <h2 className="text-xl font-bold">{movie.title}</h2>
            <p>Woke Score: {movie.wokeScore}/10</p>
          </div>
        ))}
      </div>
    </div>
  );
}
