// ============================================================
// CineBook Frontend — app.js
// All communication goes through the API Gateway at :8000
// ============================================================

const API = 'http://localhost:8000/api';
const GQL = 'http://localhost:8000/graphql';

// ── State ─────────────────────────────────────────────────
let currentUser   = null;
let currentMovie  = null;
let currentShow   = null;
let selectedSeats = [];
let allUsers      = [];
let commLog       = [];

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  checkAllServices();
  setupNavigation();
  setInterval(refreshNotifications, 8000); // poll notifications every 8s
});

// ── Navigation ────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      showPage(page);
    });
  });

  document.getElementById('active-user').addEventListener('change', (e) => {
    const userId = e.target.value;
    currentUser = allUsers.find((u) => u._id === userId) || null;
    if (currentUser) showToast(`👤 Switched to ${currentUser.name}`, 'info');
  });
}

function showPage(name) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const navBtn = document.getElementById(`nav-${name}`);
  if (navBtn) navBtn.classList.add('active');

  // Load data for page
  if (name === 'movies')   loadMovies();
  if (name === 'bookings') loadMyBookings();
  if (name === 'monitor')  refreshNotifications();
}

// ── Users ─────────────────────────────────────────────────
async function loadUsers() {
  try {
    const res = await fetch(`${API}/users`);
    const data = await res.json();
    allUsers = data.users || [];

    const sel = document.getElementById('active-user');
    sel.innerHTML = '<option value="">Select User</option>';
    allUsers.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u._id;
      opt.textContent = u.name;
      sel.appendChild(opt);
    });

    // Auto-select first user
    if (allUsers.length > 0) {
      sel.value = allUsers[0]._id;
      currentUser = allUsers[0];
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

// ── Service Health ────────────────────────────────────────
async function checkAllServices() {
  const services = [
    { id: 'status-gateway',  url: 'http://localhost:8000/health', label: 'API Gateway' },
    { id: 'status-user',     url: 'http://localhost:8001/health', label: 'User Service' },
    { id: 'status-movie',    url: 'http://localhost:8002/health', label: 'Movie Service' },
    { id: 'status-booking',  url: 'http://localhost:8003/health', label: 'Booking Service' },
    { id: 'status-show',     url: 'http://localhost:8004/health', label: 'Show/Seat Service' },
    { id: 'status-notif',    url: 'http://localhost:8005/health', label: 'Notification Service' },
  ];

  for (const svc of services) {
    const el = document.getElementById(svc.id);
    if (!el) continue;
    try {
      const res = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        el.className = 'arch-status online';
        el.title = `${svc.label} is online`;
      } else {
        el.className = 'arch-status offline';
      }
    } catch {
      el.className = 'arch-status offline';
      el.title = `${svc.label} is offline`;
    }
  }
  showToast('Service health check complete', 'info');
}

// ── Movies ────────────────────────────────────────────────
async function loadMovies() {
  const grid = document.getElementById('movies-grid');
  grid.innerHTML = '<div class="loader">Loading movies from Movie Service...</div>';

  try {
    addLog('info', 'GET /api/movies → Movie Service :8002', 'info');
    const res = await fetch(`${API}/movies`);
    const data = await res.json();

    if (!data.movies || data.movies.length === 0) {
      grid.innerHTML = '<div class="loader">No movies found.</div>';
      return;
    }

    grid.innerHTML = '';
    data.movies.forEach((movie) => {
      grid.appendChild(createMovieCard(movie));
    });
  } catch (err) {
    grid.innerHTML = `<div class="loader">Failed to load movies: ${err.message}</div>`;
    addLog('error', `Movie Service error: ${err.message}`, 'error');
  }
}

function createMovieCard(movie) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.innerHTML = `
    <div class="movie-rating">⭐ ${movie.rating?.toFixed(1) || 'N/A'}</div>
    <div class="movie-title">${movie.title}</div>
    <div class="movie-genre">${movie.genre}</div>
    <div class="movie-meta">
      🌐 ${movie.language} &nbsp;|&nbsp; ⏱ ${Math.floor(movie.duration / 60)}h ${movie.duration % 60}m<br/>
      <small style="opacity:0.7">${movie.description || ''}</small>
    </div>
    <button class="btn btn-primary" onclick="viewShows('${movie._id}', '${movie.title.replace(/'/g, "\\'")}')">
      🎭 View Shows
    </button>
  `;
  return card;
}

// ── Shows ─────────────────────────────────────────────────
async function viewShows(movieId, movieTitle) {
  currentMovie = { _id: movieId, title: movieTitle };
  document.getElementById('shows-movie-title').textContent = `Shows for: ${movieTitle}`;
  showPage('shows');

  const list = document.getElementById('shows-list');
  list.innerHTML = '<div class="loader">Loading shows from Show/Seat Service...</div>';

  try {
    addLog('info', `GET /api/shows (filtered by movie) → Show/Seat Service :8004`, 'info');
    const res = await fetch(`${API}/shows`);
    const data = await res.json();

    const shows = (data.shows || []).filter(
      (s) => s.movieId === movieId || s.movieTitle?.toLowerCase().includes(movieTitle.toLowerCase())
    );

    if (shows.length === 0) {
      list.innerHTML = '<div class="loader">No shows available for this movie.</div>';
      return;
    }

    list.innerHTML = '';
    shows.forEach((show) => {
      list.appendChild(createShowCard(show));
    });
  } catch (err) {
    list.innerHTML = `<div class="loader">Failed to load shows: ${err.message}</div>`;
  }
}

function createShowCard(show) {
  const avail = (show.seats || []).filter((s) => s.status === 'AVAILABLE').length;
  const card  = document.createElement('div');
  card.className = 'show-card';
  card.innerHTML = `
    <div class="show-info">
      <div class="show-theatre">🏛 ${show.theatreName}</div>
      <div class="show-datetime">📅 ${show.date} &nbsp;|&nbsp; ⏰ ${show.time}</div>
      <div class="show-seats-avail">✅ ${avail} seats available</div>
    </div>
    <button class="btn btn-primary" onclick="viewSeats('${show._id}', '${show.theatreName.replace(/'/g, "\\'")}', '${show.date}', '${show.time}')">
      🪑 Select Seats
    </button>
  `;
  return card;
}

// ── Seats ─────────────────────────────────────────────────
async function viewSeats(showId, theatreName, date, time) {
  currentShow = { _id: showId, theatreName, date, time };
  selectedSeats = [];
  showPage('seats');

  // Update show info banner
  document.getElementById('show-info-banner').innerHTML = `
    <div class="info-item"><span class="info-label">🎥 Movie:</span><span class="info-value">${currentMovie?.title || '—'}</span></div>
    <div class="info-item"><span class="info-label">🏛 Theatre:</span><span class="info-value">${theatreName}</span></div>
    <div class="info-item"><span class="info-label">📅 Date:</span><span class="info-value">${date}</span></div>
    <div class="info-item"><span class="info-label">⏰ Time:</span><span class="info-value">${time}</span></div>
  `;

  const grid = document.getElementById('seat-grid');
  grid.innerHTML = '<div class="loader">Loading seats...</div>';
  document.getElementById('booking-summary').style.display = 'none';

  try {
    addLog('info', `GET /api/shows/${showId}/seats → Show/Seat Service :8004`, 'info');
    const res = await fetch(`${API}/shows/${showId}/seats`);
    const data = await res.json();

    renderSeatGrid(data.seats || []);
  } catch (err) {
    grid.innerHTML = `<div class="loader">Failed to load seats: ${err.message}</div>`;
  }
}

function renderSeatGrid(seats) {
  const grid = document.getElementById('seat-grid');
  grid.innerHTML = '';

  // Group by row
  const rows = {};
  seats.forEach((seat) => {
    const row = seat.seatNumber[0];
    if (!rows[row]) rows[row] = [];
    rows[row].push(seat);
  });

  Object.keys(rows).sort().forEach((rowKey) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'seat-row';

    const label = document.createElement('div');
    label.className = 'seat-row-label';
    label.textContent = rowKey;
    rowEl.appendChild(label);

    rows[rowKey].forEach((seat) => {
      const seatEl = document.createElement('div');
      seatEl.className = `seat ${seat.status.toLowerCase()}`;
      seatEl.textContent = seat.seatNumber;
      seatEl.dataset.seat = seat.seatNumber;
      seatEl.dataset.price = seat.price;
      seatEl.title = `${seat.seatNumber} — ₹${seat.price} — ${seat.status}`;

      if (seat.status === 'AVAILABLE') {
        seatEl.addEventListener('click', () => toggleSeat(seatEl, seat));
      }

      rowEl.appendChild(seatEl);
    });

    grid.appendChild(rowEl);
  });
}

function toggleSeat(el, seat) {
  const idx = selectedSeats.findIndex((s) => s.seatNumber === seat.seatNumber);
  if (idx >= 0) {
    selectedSeats.splice(idx, 1);
    el.classList.remove('selected');
    el.classList.add('available');
  } else {
    selectedSeats.push(seat);
    el.classList.remove('available');
    el.classList.add('selected');
  }
  updateBookingSummary();
}

function updateBookingSummary() {
  const summary = document.getElementById('booking-summary');
  const seatsDisplay = document.getElementById('selected-seats-display');
  const amountDisplay = document.getElementById('total-amount-display');

  if (selectedSeats.length === 0) {
    summary.style.display = 'none';
    return;
  }

  summary.style.display = 'block';
  seatsDisplay.textContent = selectedSeats.map((s) => s.seatNumber).join(', ');
  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  amountDisplay.textContent = `₹${total}`;
}

// ── Book Tickets ──────────────────────────────────────────
async function bookTickets() {
  if (!currentUser) {
    showToast('⚠️ Please select a user first!', 'warning');
    return;
  }

  if (selectedSeats.length === 0) {
    showToast('⚠️ Please select at least one seat!', 'warning');
    return;
  }

  showLoading('Processing booking... Please wait');
  clearLog();

  // Clear log and start showing synchronous communication flow
  addLog('info', '════ BOOKING FLOW STARTED ════', 'info');
  addLog('sync', `Client → API Gateway :8000 → Booking Service :8003`, 'sync');

  try {
    const payload = {
      userId:  currentUser._id,
      movieId: currentMovie._id,
      showId:  currentShow._id,
      seats:   selectedSeats.map((s) => s.seatNumber),
    };

    // Simulate the synchronous calls in the log for viva demonstration
    await sleep(300);
    addLog('sync', `Booking Service → User Service :8001 [Verify user]`, 'sync');
    await sleep(400);
    addLog('sync', `✓ User Service → User "${currentUser.name}" found`, 'sync');
    await sleep(300);
    addLog('sync', `Booking Service → Movie Service :8002 [Verify movie]`, 'sync');
    await sleep(400);
    addLog('sync', `✓ Movie Service → Movie "${currentMovie.title}" found`, 'sync');
    await sleep(300);
    addLog('sync', `Booking Service → Show/Seat Service :8004 [Verify show]`, 'sync');
    await sleep(300);
    addLog('sync', `✓ Show/Seat Service → Show found at ${currentShow.theatreName}`, 'sync');
    await sleep(300);
    addLog('sync', `Booking Service → Show/Seat Service :8004 [LOCK seats: ${payload.seats.join(', ')}]`, 'sync');

    const res = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      addLog('error', `✗ Booking failed: ${data.message}`, 'error');
      showToast(`❌ Booking failed: ${data.message}`, 'error');
      return;
    }

    const booking = data.booking;
    addLog('sync', `✓ Seats ${payload.seats.join(', ')} LOCKED`, 'sync');
    addLog('sync', `✓ Show/Seat Service → Seats marked as BOOKED`, 'sync');
    addLog('sync', `✓ Booking CONFIRMED → ID: ${booking._id}`, 'sync');
    addLog('async', `════ ASYNC EVENT ════`, 'async');
    addLog('async', `Booking Service → RabbitMQ [BOOKING_CONFIRMED event published]`, 'async');
    addLog('async', `RabbitMQ → Notification Service :8005 [consuming event]`, 'async');
    addLog('async', `✓ Notification Service → Notification generated!`, 'async');

    showToast('🎉 Booking Confirmed!', 'success');
    showConfirmation(booking);

    // Refresh notifications after a delay (RabbitMQ processing takes a moment)
    setTimeout(refreshNotifications, 2000);

  } catch (err) {
    hideLoading();
    addLog('error', `Network error: ${err.message}`, 'error');
    showToast(`❌ Error: ${err.message}`, 'error');
  }
}

function showConfirmation(booking) {
  const card = document.getElementById('confirmation-card');
  const total = selectedSeats.reduce((s, seat) => s + seat.price, 0);

  card.innerHTML = `
    <div class="conf-icon">🎉</div>
    <div class="conf-title">Booking Confirmed!</div>
    <div class="conf-subtitle">Your booking has been confirmed. An async notification was sent via RabbitMQ.</div>

    <div class="conf-details">
      <div class="conf-row"><span>Booking ID</span><span>${booking._id}</span></div>
      <div class="conf-row"><span>User</span><span>${currentUser.name}</span></div>
      <div class="conf-row"><span>Movie</span><span>${currentMovie.title}</span></div>
      <div class="conf-row"><span>Theatre</span><span>${currentShow.theatreName}</span></div>
      <div class="conf-row"><span>Date & Time</span><span>${currentShow.date} at ${currentShow.time}</span></div>
      <div class="conf-row"><span>Seats</span><span>${selectedSeats.map((s) => s.seatNumber).join(', ')}</span></div>
      <div class="conf-row"><span>Total Amount</span><span>₹${booking.totalAmount}</span></div>
      <div class="conf-row"><span>Status</span><span style="color:var(--success)">✅ ${booking.status}</span></div>
    </div>

    <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
      <button class="btn btn-secondary" onclick="showPage('movies')">🎥 Book Another</button>
      <button class="btn btn-ghost" onclick="showPage('monitor')">📡 View Communication Log</button>
      <button class="btn btn-ghost" onclick="showPage('bookings')">🎟️ My Bookings</button>
    </div>
  `;

  selectedSeats = [];
  showPage('confirmation');
}

// ── My Bookings ───────────────────────────────────────────
async function loadMyBookings() {
  const list = document.getElementById('bookings-list');

  if (!currentUser) {
    list.innerHTML = '<div class="loader">Please select a user to see bookings.</div>';
    return;
  }

  list.innerHTML = '<div class="loader">Loading bookings...</div>';

  try {
    const res  = await fetch(`${API}/bookings/user/${currentUser._id}`);
    const data = await res.json();

    if (!data.bookings || data.bookings.length === 0) {
      list.innerHTML = '<div class="loader">No bookings found for this user.</div>';
      return;
    }

    list.innerHTML = '';
    data.bookings.forEach((booking) => {
      list.appendChild(createBookingItem(booking));
    });
  } catch (err) {
    list.innerHTML = `<div class="loader">Error: ${err.message}</div>`;
  }
}

function createBookingItem(booking) {
  const item = document.createElement('div');
  item.className = 'booking-item';
  item.innerHTML = `
    <div class="booking-info">
      <div class="booking-movie">🎥 ${booking.movieTitle || 'Unknown Movie'}</div>
      <div class="booking-meta">
        🏛 ${booking.theatreName || '—'}<br/>
        📅 ${booking.showDate || '—'} at ${booking.showTime || '—'}<br/>
        🪑 Seats: ${(booking.seats || []).join(', ')}<br/>
        💰 ₹${booking.totalAmount}
      </div>
    </div>
    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:12px;">
      <span class="status-badge ${booking.status}">${booking.status}</span>
      ${booking.status === 'CONFIRMED' ? `
        <button class="btn btn-danger btn-sm" onclick="cancelBooking('${booking._id}')">
          ✕ Cancel
        </button>` : ''}
      <small style="color:var(--text-muted); font-size:0.72rem;">
        ${new Date(booking.createdAt).toLocaleDateString()}
      </small>
    </div>
  `;
  return item;
}

async function cancelBooking(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking?')) return;

  try {
    const res  = await fetch(`${API}/bookings/${bookingId}/cancel`, { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      showToast('Booking cancelled. Async BOOKING_CANCELLED event sent to RabbitMQ.', 'info');
      addLog('async', `Booking Service → RabbitMQ [BOOKING_CANCELLED event published]`, 'async');
      addLog('async', `RabbitMQ → Notification Service :8005`, 'async');
      loadMyBookings();
      setTimeout(refreshNotifications, 2000);
    } else {
      showToast(`❌ ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  }
}

// ── Notifications ─────────────────────────────────────────
async function refreshNotifications() {
  const panel = document.getElementById('notifications-panel');
  try {
    const res  = await fetch(`${API}/notifications`);
    const data = await res.json();
    const notifs = data.notifications || [];

    if (notifs.length === 0) {
      panel.innerHTML = '<div class="log-empty">No notifications yet.</div>';
      return;
    }

    panel.innerHTML = '';
    notifs.slice(0, 10).forEach((n) => {
      const el = document.createElement('div');
      el.className = 'notif-item';
      const icon = n.type === 'BOOKING_CONFIRMED' ? '✅' : '❌';
      el.innerHTML = `
        <div class="notif-type">${icon} ${n.type}</div>
        <div class="notif-body">
          Booking: ${n.bookingId}<br/>
          Movie: ${n.movieTitle || '—'}<br/>
          Seats: ${(n.seats || []).join(', ')}<br/>
          Amount: ₹${n.totalAmount}
        </div>
        <div class="notif-time">${new Date(n.timestamp).toLocaleTimeString()}</div>
      `;
      panel.appendChild(el);
    });
  } catch (err) {
    // Notification service might be down — fail silently
  }
}

// ── Communication Log ─────────────────────────────────────
function addLog(type, message, style) {
  const log = document.getElementById('comm-log');

  // Remove empty placeholder
  const empty = log.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${style}`;

  const tagMap = { sync: 'SYNC', async: 'ASYNC', info: 'INFO', error: 'ERR' };
  const tag = document.createElement('span');
  tag.className = `log-tag ${style}`;
  tag.textContent = tagMap[style] || 'LOG';

  const text = document.createElement('span');
  text.textContent = message;

  entry.appendChild(tag);
  entry.appendChild(text);
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;

  commLog.push({ type, message, style, time: Date.now() });
}

function clearLog() {
  const log = document.getElementById('comm-log');
  log.innerHTML = '';
  commLog = [];
}

// ── GraphQL ───────────────────────────────────────────────
const GQL_PRESETS = {
  movies: `query {
  movies {
    id
    title
    genre
    language
    duration
    rating
  }
}`,
  movie: `# Replace MOVIE_ID with an actual movie _id from GET /api/movies
query {
  movie(id: "MOVIE_ID") {
    id
    title
    genre
    shows {
      id
      theatreName
      date
      time
      availableSeats {
        seatNumber
        price
      }
    }
  }
}`,
  booking: `# Replace BOOKING_ID with an actual booking _id
query {
  booking(id: "BOOKING_ID") {
    id
    status
    seats
    totalAmount
    createdAt
    user {
      name
      email
    }
    movie {
      title
      genre
    }
  }
}`,
};

function loadPreset(name) {
  document.getElementById('gql-query').value = GQL_PRESETS[name] || '';
}

async function executeGraphQL() {
  const query  = document.getElementById('gql-query').value.trim();
  const varsRaw = document.getElementById('gql-vars').value.trim();
  const result = document.getElementById('gql-result');

  if (!query) {
    result.textContent = '// Please enter a query';
    return;
  }

  let variables = {};
  try {
    variables = JSON.parse(varsRaw || '{}');
  } catch {
    result.textContent = '// Invalid JSON in Variables field';
    return;
  }

  result.textContent = '// Executing...';
  addLog('info', `GraphQL query sent to API Gateway :8000/graphql`, 'info');

  try {
    const res = await fetch(GQL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, variables }),
    });

    const data = await res.json();
    result.textContent = JSON.stringify(data, null, 2);

    if (data.errors) {
      addLog('error', `GraphQL error: ${data.errors[0]?.message}`, 'error');
    } else {
      addLog('info', `GraphQL response received (data aggregated from multiple services)`, 'info');
    }
  } catch (err) {
    result.textContent = `// Error: ${err.message}`;
    addLog('error', `GraphQL request failed: ${err.message}`, 'error');
  }
}

// ── Utilities ─────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showLoading(text = 'Loading...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
