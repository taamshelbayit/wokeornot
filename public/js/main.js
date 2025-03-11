// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("JavaScript Loaded: UI Enhancements Active");

  // 1️⃣ Dark Mode Toggle
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      localStorage.setItem("darkMode", document.body.classList.contains("dark-mode") ? "enabled" : "disabled");
    });

    // Load saved mode
    if (localStorage.getItem("darkMode") === "enabled") {
      document.body.classList.add("dark-mode");
    }
  }

  // 2️⃣ Horizontal Scroll Buttons for Movie Carousels
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

  // 3️⃣ Real-Time Notifications (Socket.IO)
  if (window.USER_ID) {
    const socket = io();
    socket.emit('join', window.USER_ID);

    socket.on('notification', data => {
      console.log("New Notification:", data);

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

        // Animate new notification
        countSpan.style.transform = "scale(1.3)";
        setTimeout(() => countSpan.style.transform = "scale(1)", 300);
      }
    });
  }

  // 4️⃣ Load More Button for Search Results (AJAX)
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async function() {
      const nextPage = this.dataset.nextpage;
      const sortParam = this.dataset.sortparam;
      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get('q') || '';

      try {
        const res = await fetch(`/search?q=${encodeURIComponent(q)}&page=${nextPage}&sort=${sortParam}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!res.ok) throw new Error('Failed to load more');

        const data = await res.json();
        const container = document.getElementById('searchResults');
        data.items.forEach(item => {
          const col = document.createElement('div');
          col.className = 'col-md-3 col-sm-6 mb-4';
          col.innerHTML = `
            <div class="card h-100">
              ${item.posterPath ? `
                <img src="https://image.tmdb.org/t/p/w500${item.posterPath}" class="card-img-top" alt="${item.title}">
              ` : ''}
              <div class="card-body">
                <h5 class="card-title">${item.title}</h5>
                <p>${item.averageRating ? `${item.averageRating.toFixed(1)}/10` : 'No Ratings'}</p>
                <a href="/movies/${item._id}" class="btn btn-sm btn-outline-warning">View</a>
              </div>
            </div>
          `;
          container.appendChild(col);
        });

        if (data.currentPage < data.totalPages) {
          loadMoreBtn.dataset.nextpage = data.currentPage + 1;
        } else {
          loadMoreBtn.remove();
        }
      } catch (err) {
        console.error(err);
        alert('Error loading more results.');
      }
    });
  }
});
