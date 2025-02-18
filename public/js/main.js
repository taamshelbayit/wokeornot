// public/js/main.js
console.log("Custom JS loaded");
// public/js/main.js

document.addEventListener("DOMContentLoaded", () => {
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
    });
  }
});
