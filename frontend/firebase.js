import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCja7YVi3WkiltSeDIJAkSCRPdWsB0kov4",
  authDomain: "wokeornot-588b2.firebaseapp.com",
  projectId: "wokeornot-588b2",
  storageBucket: "wokeornot-588b2.appspot.com",
  messagingSenderId: "269104487061",
  appId: "1:269104487061:web:98ae77301074081636d99c",
  measurementId: "G-4R70D46K5V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

