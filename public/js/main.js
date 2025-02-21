// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  const leftButtons = document.querySelectorAll('.scroll-btn.left-btn');
  const rightButtons = document.querySelectorAll('.scroll-btn.right-btn');

  leftButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const wrapper = document.getElementById(targetId);
      // Scroll left by 300px
      wrapper.scrollBy({ left: -300, behavior: 'smooth' });
    });
  });

  rightButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const wrapper = document.getElementById(targetId);
      // Scroll right by 300px
      wrapper.scrollBy({ left: 300, behavior: 'smooth' });
    });
  });
});
