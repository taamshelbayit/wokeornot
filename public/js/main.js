// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  // Horizontal scroll buttons for carousels
  const leftButtons = document.querySelectorAll('.scroll-btn.left-btn');
  const rightButtons = document.querySelectorAll('.scroll-btn.right-btn');
  leftButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const wrapper = document.getElementById(targetId);
      wrapper.scrollBy({ left: -300, behavior: 'smooth' });
    });
  });
  rightButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const wrapper = document.getElementById(targetId);
      wrapper.scrollBy({ left: 300, behavior: 'smooth' });
    });
  });

  // Connect to Socket.IO for real-time notifications
  if (window.USER_ID) {
    const socket = io();  // establish socket connection
    socket.emit('join', window.USER_ID);  // join user-specific room
    socket.on('notification', data => {
      // When a notification event is received, update the nav link badge
      const notifLink = document.querySelector('a[href="/notifications"]');
      if (notifLink) {
        let countSpan = notifLink.querySelector('.notif-count');
        if (!countSpan) {
          countSpan = document.createElement('span');
          countSpan.className = 'notif-count';
          notifLink.appendChild(countSpan);
        }
        const current = parseInt(countSpan.textContent) || 0;
        countSpan.textContent = current + 1;
      }
    });
  }
});
