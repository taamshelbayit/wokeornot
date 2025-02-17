import { useState } from "react";
import { auth, googleProvider } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign in with Email & Password
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Login Successful!");
    } catch (error) {
      alert(error.message);
    }
  };

  // Register New User
  const handleRegister = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Account Created!");
    } catch (error) {
      alert(error.message);
    }
  };

  // Sign in with Google
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      alert("Google Login Successful!");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Login / Register</h1>
      
      <input 
        type="email" 
        placeholder="Email" 
        className="p-2 border mb-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input 
        type="password" 
        placeholder="Password" 
        className="p-2 border mb-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded mb-2">Login</button>
      <button onClick={handleRegister} className="bg-green-500 text-white p-2 rounded mb-2">Register</button>
      <button onClick={handleGoogleLogin} className="bg-red-500 text-white p-2 rounded">Login with Google</button>
    </div>
  );
}
