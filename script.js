'use strict';

/* =============================================
   CONFIG & STATE
============================================= */
const API_KEY  = 'b36a1de48e5008bd653343edc34d45e5';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG      = (p, s = 'w500') => p ? `https://image.tmdb.org/t/p/${s}${p}` : null;
const FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="152" height="228" viewBox="0 0 152 228"%3E%3Crect width="152" height="228" fill="%23141419"/%3E%3Ctext x="76" y="114" text-anchor="middle" fill="%237a7a8c" font-size="10" font-family="monospace"%3ENo Image%3C/text%3E%3C/svg%3E';

const GENRE_MAP = {
  28:'Action',18:'Drama',35:'Comedy',27:'Horror',10749:'Romance',
  878:'Sci-Fi',53:'Thriller',12:'Adventure',14:'Fantasy',
  36:'History',99:'Documentary',10751:'Family',9648:'Mystery',
  80:'Crime',37:'Western',10752:'War',16:'Animation'
};
const VIBE_TONE_WORDS = {
  28: ['High Octane','Visceral','Kinetic'],
  18: ['Emotional','Character-Driven','Raw'],
  35: ['Witty','Light','Joyful'],
  27: ['Dread','Unsettling','Tense'],
  10749: ['Tender','Passionate','Warm'],
  878: ['Cerebral','Visionary','Strange'],
  53: ['Paranoid','Suspenseful','Twisty'],
  12: ['Grand','Sweeping','Epic'],
  14: ['Imaginative','Mythic','Wondrous'],
  9648: ['Puzzling','Shadowy','Enigmatic'],
  80: ['Gritty','Morally-Grey','Sharp'],
  99: ['Revelatory','True','Profound'],
  16: ['Playful','Vibrant','Timeless']
};

const getGenreName = id => GENRE_MAP[id] || '';
const toYear  = d  => d ? d.slice(0, 4) : '—';
const toRating = n => (n && n > 0) ? n.toFixed(1) : '—';

// State
let favorites      = JSON.parse(localStorage.getItem('mv_favorites') || '[]');
let watchedList    = JSON.parse(localStorage.getItem('mv_watched') || '[]');
let personalRatings= JSON.parse(localStorage.getItem('mv_ratings') || '{}');
let cineScore      = JSON.parse(localStorage.getItem('mv_cinescore') || '{}');
let heroMovies     = [];
let heroIdx        = 0;
let heroTimer      = null;
let heroCurrentId  = null;
let compareMode    = false;
let compareItems   = [null, null];

const RATING_LABELS = ['', "Didn't Like It", 'It Was OK', 'Liked It', 'Really Liked It', 'Masterpiece ◉'];

/* =============================================
   DOM REFS
============================================= */
const $  = id => document.getElementById(id);
const header          = $('header');
const heroTitle       = $('heroTitle');
const heroOverview    = $('heroOverview');
const heroMeta        = $('heroMeta');
const heroToneWords   = $('heroToneWords');
const heroGenres      = $('heroGenres');
const heroFavBtn      = $('heroFavBtn');
const heroFavText     = $('heroFavText');
const heroFavIcon     = document.querySelector('.hero-fav-icon');
const heroWatchedBtn  = $('heroWatchedBtn');
const heroWatchedText = $('heroWatchedText');
const heroDetailsBtn  = $('heroDetailsBtn');
const favBtn          = $('favoritesBtn');
const favPanel        = $('favPanel');
const favOverlay      = $('favOverlay');
const favList         = $('favList');
const favCountEl      = $('favCount');
const modal           = $('modal');
const modalBackdrop   = $('modalBackdrop');
const modalBody       = $('modalBody');
const similarList     = $('similarList');
const closeModalBtn   = $('closeModal');
const seeAllModal     = $('seeAllModal');
const seeAllBackdrop  = $('seeAllBackdrop');
const seeAllTitle     = $('seeAllTitle');
const seeAllGrid      = $('seeAllGrid');
const closeSeeAllBtn  = $('closeSeeAll');
const mobileMenuBtn   = $('mobileMenuBtn');
const mobileNav       = $('mobileNav');
const moodResults     = $('moodResults');
const moodMovies      = $('moodMovies');
const moodResultsLabel = $('moodResultsLabel');
const compareBar      = $('compareBar');
const compareSlot1    = $('compareSlot1');
const compareSlot2    = $('compareSlot2');
const compareNowBtn   = $('compareNowBtn');
const clearCompareBtn = $('clearCompareBtn');
const compareToggleBtn = $('compareToggleBtn');
const oracleBtn       = $('oracleBtn');
const oracleModal     = $('oracleModal');
const oracleBackdrop  = $('oracleBackdrop');
const oracleSpinBtn   = $('oracleSpinBtn');
const oracleClose     = $('oracleClose');
const oracleReel      = $('oracleReel');
const oracleResult    = $('oracleResult');
const oracleSpinText  = $('oracleSpinText');
const cineScoreBtn    = $('cineScoreBtn');
const cineScorePanel  = $('cineScorePanel');
const cineScoreOverlay = $('cineScoreOverlay');
const compareModal    = $('compareModal');
const compareBackdrop = $('compareBackdrop');
const closeCompareBtn = $('closeCompare');
const compareGrid     = $('compareGrid');

/* =============================================
   HEADER SCROLL + BACK TO TOP
============================================= */
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 30);
  const btt = $('backToTop');
  if (btt) btt.classList.toggle('visible', window.scrollY > 500);
}, { passive: true });

$('backToTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* =============================================
   TOAST NOTIFICATIONS
============================================= */
function showToast(message, type = 'default') {
  const container = $('toastContainer');
  if (!container) return;
  const icons = { success: '✓', heart: '♥', star: '★', info: '◎', default: '◉' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.default}</span><span class="toast-msg">${escHtml(message)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-show')));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2800);
}

/* =============================================
   SCROLL-SPY — auto-highlight active nav section
============================================= */
const SPY_MAP = [
  ['hero',              '#hero'],
  ['directorsCut',      '#hero'],
  ['section-trending',  '#section-trending'],
  ['section-topRated',  '#section-topRated'],
  ['section-upcoming',  '#section-upcoming'],
  ['cast-explorer',     '#cast-explorer'],
  ['world-cinema',      '#world-cinema'],
  ['decade-machine',    '#decade-machine'],
  ['poster-guesser',    '#poster-guesser'],
  ['mood-matcher',      '#mood-matcher'],
];
let _spyFrame = false;
window.addEventListener('scroll', () => {
  if (_spyFrame) return;
  _spyFrame = true;
  requestAnimationFrame(() => {
    const mid = window.scrollY + window.innerHeight * 0.3;
    let best = '#hero';
    for (const [id, nav] of SPY_MAP) {
      const el = $(id);
      if (el && el.offsetTop <= mid + 60) best = nav;
    }
    const cur = document.querySelector('.nav-link.active');
    const nxt = document.querySelector(`.nav-link[href="${best}"]`);
    if (nxt && cur !== nxt) {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      nxt.classList.add('active');
      updateNavIndicator(nxt);
    }
    _spyFrame = false;
  });
}, { passive: true });

/* =============================================
   PERSONAL STAR RATINGS
============================================= */
let _ratingMovie = null;
let _ratingPending = 0;

function openRatingModal(movie) {
  _ratingMovie = movie;
  _ratingPending = personalRatings[movie.id] || 0;
  $('ratingFilmTitle').textContent = movie.title || movie.name || '—';
  const col = $('ratingPosterCol');
  col.innerHTML = movie.poster_path
    ? `<img src="${IMG(movie.poster_path,'w185')}" alt="" loading="lazy">`
    : '';
  applyStars(_ratingPending);
  $('ratingModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function applyStars(n) {
  _ratingPending = n;
  document.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.classList.toggle('lit', i < n);
  });
  $('ratingDesc').textContent = n > 0 ? RATING_LABELS[n] : 'Hover to rate';
}

document.querySelectorAll('.star-btn').forEach((btn, idx) => {
  btn.addEventListener('mouseenter', () => {
    document.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('hover', i <= idx));
    $('ratingDesc').textContent = RATING_LABELS[idx + 1];
  });
  btn.addEventListener('mouseleave', () => {
    document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('hover'));
    $('ratingDesc').textContent = _ratingPending > 0 ? RATING_LABELS[_ratingPending] : 'Hover to rate';
  });
  btn.addEventListener('click', () => applyStars(idx + 1));
});

$('ratingSaveBtn').addEventListener('click', () => {
  if (!_ratingMovie || !_ratingPending) return;
  personalRatings[_ratingMovie.id] = _ratingPending;
  localStorage.setItem('mv_ratings', JSON.stringify(personalRatings));
  showToast(`Rated "${_ratingMovie.title || _ratingMovie.name}" ${_ratingPending}★`, 'star');
  refreshCardRating(_ratingMovie.id);
  closeRatingModal();
});
$('ratingClearBtn').addEventListener('click', () => {
  if (!_ratingMovie) return;
  delete personalRatings[_ratingMovie.id];
  localStorage.setItem('mv_ratings', JSON.stringify(personalRatings));
  applyStars(0);
  refreshCardRating(_ratingMovie.id);
});
$('ratingCancelBtn').addEventListener('click', closeRatingModal);
$('ratingBackdrop').addEventListener('click', closeRatingModal);
function closeRatingModal() {
  $('ratingModal').classList.add('hidden');
  document.body.style.overflow = '';
  _ratingMovie = null;
}
function refreshCardRating(movieId) {
  document.querySelectorAll(`.card[data-movie-id="${movieId}"]`).forEach(card => {
    let badge = card.querySelector('.card-personal-rating');
    const r = personalRatings[movieId];
    if (r) {
      if (!badge) { badge = document.createElement('div'); badge.className = 'card-personal-rating'; card.appendChild(badge); }
      badge.textContent = '★'.repeat(r);
    } else if (badge) badge.remove();
  });
}



/* =============================================
   NAV SLIDING INDICATOR
============================================= */
function updateNavIndicator(activeLink) {
  const indicator = $('navIndicator');
  const navEl = document.getElementById('mainNav');
  if (!indicator || !activeLink || !navEl) return;
  const navRect = navEl.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  const trackEl = document.querySelector('.nav-track');
  const trackRect = trackEl ? trackEl.getBoundingClientRect() : navRect;
  indicator.style.left = (linkRect.left - trackRect.left) + 'px';
  indicator.style.width = linkRect.width + 'px';
  indicator.style.opacity = '1';
}

// Init indicator on first active link
setTimeout(() => {
  const active = document.querySelector('.nav-link.active');
  if (active) updateNavIndicator(active);
}, 100);

/* =============================================
   SMOOTH NAV
============================================= */
document.querySelectorAll('.nav-link, .mobile-nav-item, .footer-links a').forEach(link => {
  link.addEventListener('click', e => {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    // Close mobile nav
    mobileNav.classList.add('hidden');
    mobileMenuBtn.classList.remove('open');
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navMatch = document.querySelector(`.nav-link[href="${href}"]`);
    if (navMatch) {
      navMatch.classList.add('active');
      updateNavIndicator(navMatch);
    }
  });
});

$('logoLink').addEventListener('click', e => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const homeLink = document.querySelector('.nav-link[href="#hero"]');
  if (homeLink) { homeLink.classList.add('active'); updateNavIndicator(homeLink); }
});

mobileMenuBtn.addEventListener('click', () => {
  mobileNav.classList.toggle('hidden');
  mobileMenuBtn.classList.toggle('open');
});

/* =============================================
   SKELETON
============================================= */
function renderSkeletons(containerId, count = 8) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton">
      <div class="skeleton-poster"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  `).join('');
}

/* =============================================
   API
============================================= */
async function apiFetch(endpoint, params = {}) {
  const qs = new URLSearchParams({ api_key: API_KEY, ...params }).toString();
  const res = await fetch(`${BASE_URL}${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* =============================================
   HTML ESCAPE
============================================= */
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* =============================================
   PROGRESS RING RATING
============================================= */
function makeRatingRing(rating) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((rating || 0) / 10, 1);
  const offset = circ * (1 - pct);
  const cls = rating >= 7.5 ? 'rating-high' : rating >= 6 ? 'rating-mid' : 'rating-low';
  return `
    <svg class="card-rating-ring" viewBox="0 0 34 34">
      <circle class="ring-bg" cx="17" cy="17" r="${r}"/>
      <circle class="ring-fg ${cls}" cx="17" cy="17" r="${r}"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
      <text class="ring-text" x="17" y="17">${rating > 0 ? rating.toFixed(1) : '—'}</text>
    </svg>
  `;
}

/* =============================================
   TONE WORDS
============================================= */
function getToneWords(genreIds) {
  const words = new Set();
  (genreIds || []).slice(0, 3).forEach(id => {
    const list = VIBE_TONE_WORDS[id];
    if (list) list.slice(0, 2).forEach(w => words.add(w));
  });
  return [...words].slice(0, 4);
}

/* =============================================
   CREATE CARD
============================================= */
function createCard(movie, onClick) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.movieId = movie.id;
  div.dataset.genreIds = JSON.stringify(movie.genre_ids || []);

  const isWatched = watchedList.includes(movie.id);
  if (isWatched) div.classList.add('watched-card');
  if (compareItems.some(c => c && c.id === movie.id)) div.classList.add('in-compare');

  const poster   = IMG(movie.poster_path) || FALLBACK;
  const rating   = movie.vote_average || 0;
  const myRating = personalRatings[movie.id];

  const genreTags = (movie.genre_ids || []).slice(0, 2)
    .map(id => getGenreName(id)).filter(Boolean)
    .map(n => `<span class="card-genre-tag">${escHtml(n)}</span>`).join('');

  div.innerHTML = `
    ${makeRatingRing(rating)}
    <button class="card-compare-btn" title="Add to Compare">⊕</button>
    <button class="card-rate-btn" title="Rate this film">★</button>
    ${myRating ? `<div class="card-personal-rating">${'★'.repeat(myRating)}</div>` : ''}
    <div class="card-poster">
      <img src="${poster}" alt="${escHtml(movie.title || movie.name)}" loading="lazy" onerror="this.src='${FALLBACK}'">
      <div class="card-overlay">
        <div class="card-play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        <div class="card-year-overlay">${toYear(movie.release_date)}</div>
        ${genreTags ? `<div class="card-genre-row">${genreTags}</div>` : ''}
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${escHtml(movie.title || movie.name || 'Untitled')}</div>
    </div>
  `;

  div.querySelector('.card-compare-btn').addEventListener('click', e => {
    e.stopPropagation();
    addToCompare(movie, div);
  });
  div.querySelector('.card-rate-btn').addEventListener('click', e => {
    e.stopPropagation();
    openRatingModal(movie);
  });
  div.addEventListener('click', () => {
    trackCineScore(movie);
    onClick(movie.id);
  });
  return div;
}

/* =============================================
   DISPLAY MOVIES
============================================= */
function displayMovies(movies, containerId, openFn = openModal) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = '';
  const filtered = (movies || []).filter(m => m.poster_path);
  if (!filtered.length) {
    el.innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">No films found.</p>';
    return;
  }
  filtered.forEach(m => el.appendChild(createCard(m, openFn)));
}

/* =============================================
   FETCH SECTION
============================================= */
async function fetchSection(endpoint, containerId) {
  renderSkeletons(containerId);
  try {
    const data = await apiFetch(endpoint);
    displayMovies(data.results, containerId);
  } catch (e) {
    const el = $(containerId);
    if (el) el.innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">Failed to load.</p>';
    console.error(e);
  }
}

/* =============================================
   HERO — REDESIGNED CAROUSEL
============================================= */
let heroTransitionBusy = false;

async function loadHero() {
  try {
    const data = await apiFetch('/trending/movie/day');
    heroMovies = (data.results || []).filter(m => m.backdrop_path && m.overview && m.poster_path);
    if (!heroMovies.length) return;

    const count = Math.min(heroMovies.length, 8);

    // Build slide backgrounds
    const slidesContainer = $('heroSlides');
    if (slidesContainer) {
      slidesContainer.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const slide = document.createElement('div');
        slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
        slide.style.backgroundImage = `url(${IMG(heroMovies[i].backdrop_path, 'original')})`;
        slidesContainer.appendChild(slide);
      }
    }

    // Build thumbnail strip
    buildThumbnailStrip(count);

    renderHero(0, false);
    heroTimer = setInterval(() => goHero((heroIdx + 1) % count), 9000);
  } catch (e) { console.error('loadHero:', e); }
}

function buildThumbnailStrip(count) {
  const strip = $('heroStripInner');
  if (!strip) return;
  strip.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const m = heroMovies[i];
    const thumb = document.createElement('button');
    thumb.className = 'hero-thumb' + (i === 0 ? ' active' : '');
    thumb.setAttribute('aria-label', `Go to slide ${i + 1}: ${m.title}`);
    thumb.innerHTML = `
      <img src="${IMG(m.backdrop_path, 'w300')}" alt="${escHtml(m.title)}" loading="lazy">
      <div class="hero-thumb-overlay"></div>
      <span class="hero-thumb-num">${String(i + 1).padStart(2, '0')}</span>
    `;
    thumb.addEventListener('click', () => goHero(i));
    strip.appendChild(thumb);
  }
}

function goHero(idx) {
  if (heroTransitionBusy || idx === heroIdx) return;
  heroTransitionBusy = true;

  const prevIdx = heroIdx;
  heroIdx = idx;

  // Slides
  const slides = document.querySelectorAll('.hero-slide');
  slides.forEach((s, i) => {
    if (i === prevIdx) { s.classList.remove('active'); s.classList.add('prev'); }
    else if (i === idx) { s.classList.add('active'); s.classList.remove('prev'); }
    else { s.classList.remove('active', 'prev'); }
  });

  // Thumbnail strip
  document.querySelectorAll('.hero-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));

  // Scroll active thumb within the strip only — NOT scrollIntoView (which scrolls the page)
  const activeThumb = document.querySelector('.hero-thumb.active');
  const stripEl = $('heroStrip');
  if (activeThumb && stripEl) {
    const thumbLeft = activeThumb.offsetLeft;
    const thumbWidth = activeThumb.offsetWidth;
    const stripWidth = stripEl.offsetWidth;
    stripEl.scrollTo({
      left: thumbLeft - (stripWidth / 2) + (thumbWidth / 2),
      behavior: 'smooth'
    });
  }

  // Animate content out then back in
  const content = $('heroContent');
  const posterCard = $('heroPosterCard');
  if (content) content.classList.add('transitioning');
  if (posterCard) posterCard.classList.add('transitioning');

  setTimeout(() => {
    renderHero(idx, true);
    if (content) content.classList.remove('transitioning');
    if (posterCard) posterCard.classList.remove('transitioning');
    // Clean up prev after transition
    setTimeout(() => {
      slides.forEach((s, i) => { if (i === prevIdx) s.classList.remove('prev'); });
      heroTransitionBusy = false;
    }, 400);
  }, 280);
}

function renderHero(idx, animated = false) {
  const movie = heroMovies[idx];
  if (!movie) return;
  heroCurrentId = movie.id;

  // Meta row
  heroMeta.innerHTML = `
    <span class="hero-badge">Trending #${idx + 1}</span>
    <span class="hero-rating-pill">
      <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ${toRating(movie.vote_average)}
    </span>
    <span class="hero-year-pill">${toYear(movie.release_date)}</span>
  `;

  heroTitle.textContent = movie.title;
  heroOverview.textContent = movie.overview;

  // Tone words
  const toneWords = getToneWords(movie.genre_ids || []);
  heroToneWords.innerHTML = toneWords.map(w => `<span class="hero-tone-word">${w}</span>`).join('');

  // Genre tags
  if (heroGenres) {
    heroGenres.innerHTML = (movie.genre_ids || []).slice(0, 4)
      .map(id => getGenreName(id)).filter(Boolean)
      .map(name => `<span class="hero-genre-tag">${escHtml(name)}</span>`).join('');
  }

  // Poster card
  const posterImg = $('heroPosterImg');
  if (posterImg) {
    posterImg.style.opacity = '0';
    posterImg.src = IMG(movie.poster_path, 'w342') || FALLBACK;
    posterImg.onload = () => { posterImg.style.opacity = '1'; };
    posterImg.onerror = () => { posterImg.src = FALLBACK; posterImg.style.opacity = '1'; };
    posterImg.alt = escHtml(movie.title);
  }

  // Poster stats
  const statsEl = $('heroPosterStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="hero-stat-row">
        <span class="hero-stat-label">Rating</span>
        <span class="hero-stat-value gold">★ ${toRating(movie.vote_average)}</span>
      </div>
      <div class="hero-stat-row">
        <span class="hero-stat-label">Year</span>
        <span class="hero-stat-value">${toYear(movie.release_date)}</span>
      </div>
      ${movie.vote_count ? `<div class="hero-stat-row"><span class="hero-stat-label">Votes</span><span class="hero-stat-value teal">${(movie.vote_count).toLocaleString()}</span></div>` : ''}
    `;
  }

  updateHeroFavBtn(movie.id);
  updateHeroWatchedBtn(movie.id);
}

function updateHeroFavBtn(movieId) {
  const isFav = favorites.some(f => f.id === movieId);
  if (isFav) {
    heroFavIcon.setAttribute('fill', 'currentColor');
    heroFavIcon.removeAttribute('stroke');
    heroFavBtn.classList.add('in-list');
    heroFavText.textContent = 'In Watchlist';
  } else {
    heroFavIcon.setAttribute('fill', 'none');
    heroFavIcon.setAttribute('stroke', 'currentColor');
    heroFavBtn.classList.remove('in-list');
    heroFavText.textContent = 'Add to List';
  }
}

function updateHeroWatchedBtn(movieId) {
  const isWatched = watchedList.includes(movieId);
  heroWatchedBtn.classList.toggle('watched', isWatched);
  heroWatchedText.textContent = isWatched ? '✓ Watched' : 'Mark Watched';
}

heroDetailsBtn.addEventListener('click', () => { if (heroCurrentId) openModal(heroCurrentId); });

heroFavBtn.addEventListener('click', () => {
  if (!heroCurrentId) return;
  const movie = heroMovies.find(m => m.id === heroCurrentId);
  if (movie) { toggleFavorite(movie); updateHeroFavBtn(heroCurrentId); }
});

heroWatchedBtn.addEventListener('click', () => {
  if (!heroCurrentId) return;
  const movie = heroMovies.find(m => m.id === heroCurrentId);
  toggleWatched(heroCurrentId, movie ? movie.title : '');
  updateHeroWatchedBtn(heroCurrentId);
  refreshCardWatchedState(heroCurrentId);
});

/* =============================================
   VIBE FILTER BAR
============================================= */
let activeVibe = 'all';
let activeVibeGenres = null;

document.querySelectorAll('.vibe-pill').forEach(pill => {
  pill.addEventListener('click', async () => {
    document.querySelectorAll('.vibe-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeVibe = pill.dataset.vibe;
    const genres = pill.dataset.genres;

    if (activeVibe === 'all') {
      activeVibeGenres = null;
      await reloadAllSections();
      return;
    }

    activeVibeGenres = genres;
    // Filter all rows simultaneously
    await filterAllByVibe(genres);
  });
});

async function reloadAllSections() {
  await Promise.all([
    fetchSection('/trending/movie/day', 'trending'),
    fetchSection('/movie/top_rated', 'topRated'),
    fetchSection('/movie/upcoming', 'upcoming'),
    fetchSection('/movie/now_playing', 'nowPlaying'),
  ]);
}

async function filterAllByVibe(genres) {
  const sections = [
    { id: 'trending',   params: { with_genres: genres, sort_by: 'popularity.desc',     'vote_count.gte': 200 } },
    { id: 'topRated',   params: { with_genres: genres, sort_by: 'vote_average.desc',   'vote_count.gte': 1000 } },
    { id: 'upcoming',   params: { with_genres: genres, sort_by: 'primary_release_date.desc', 'primary_release_date.gte': new Date().toISOString().slice(0,10) } },
    { id: 'nowPlaying', params: { with_genres: genres, sort_by: 'popularity.desc',     'vote_count.gte': 100, 'primary_release_date.lte': new Date().toISOString().slice(0,10) } },
  ];
  sections.forEach(s => renderSkeletons(s.id, 6));
  await Promise.all(sections.map(async s => {
    try {
      const data = await apiFetch('/discover/movie', s.params);
      displayMovies(data.results || [], s.id);
    } catch(e) {
      const el = $(s.id);
      if (el) el.innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">Failed to load.</p>';
    }
  }));
}

/* =============================================
   DIRECTOR'S CUT SPOTLIGHT
============================================= */
const DC_CONNECTIONS = [
  { liked: 'Inception', pick: 'Primer' },
  { liked: 'The Dark Knight', pick: 'Heat' },
  { liked: 'Parasite', pick: 'Shoplifters' },
  { liked: 'Hereditary', pick: 'The Witch' },
  { liked: 'Interstellar', pick: 'Contact' },
  { liked: 'La La Land', pick: 'Whiplash' },
  { liked: 'The Shawshank Redemption', pick: 'Cool Hand Luke' },
];

async function loadDirectorsCut() {
  try {
    // Pick a lesser-known but highly rated film
    const page = Math.floor(Math.random() * 15) + 2;
    const data = await apiFetch('/discover/movie', {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 500,
      'vote_count.lte': 8000,
      'vote_average.gte': 7.8,
      page,
    });
    const movies = (data.results || []).filter(m => m.poster_path && m.overview);
    if (!movies.length) return;
    const movie = movies[Math.floor(Math.random() * movies.length)];
    const conn = DC_CONNECTIONS[Math.floor(Math.random() * DC_CONNECTIONS.length)];
    const tone = getToneWords(movie.genre_ids || []);
    const poster = IMG(movie.poster_path, 'w185') || FALLBACK;

    $('dcContent').innerHTML = `
      <div class="dc-card">
        <div class="dc-poster">
          <img src="${poster}" alt="${escHtml(movie.title)}" loading="lazy">
        </div>
        <div class="dc-info">
          <div class="dc-title">${escHtml(movie.title)}</div>
          <div class="dc-meta">${toYear(movie.release_date)} · ★ ${toRating(movie.vote_average)}</div>
          <blockquote class="dc-quote">${escHtml(movie.overview.slice(0, 140))}…</blockquote>
          <div class="dc-tone-row">${tone.map(w => `<span class="dc-tone">${w}</span>`).join('')}</div>
          <div class="dc-watch-if">Watch if you loved <strong>${escHtml(conn.liked)}</strong></div>
          <button class="dc-open-btn" data-id="${movie.id}">Open in Oracle →</button>
        </div>
      </div>
    `;

    $('dcContent').querySelector('.dc-open-btn').addEventListener('click', () => {
      trackCineScore(movie);
      openModal(movie.id);
    });
  } catch(e) { console.error('DC error:', e); }
}

/* =============================================
   MODAL — DUAL PANE
============================================= */
async function openModal(id) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const spinner = `<div style="height:260px;display:flex;align-items:center;justify-content:center;"><div class="search-spinner" style="width:32px;height:32px;border-width:2px;"></div></div>`;
  modalBody.innerHTML = spinner;
  similarList.innerHTML = '<div style="padding:16px;font-family:monospace;font-size:11px;color:var(--text-muted);letter-spacing:1px;">Loading…</div>';

  try {
    const [details, credits, videos, similar] = await Promise.all([
      apiFetch(`/movie/${id}`),
      apiFetch(`/movie/${id}/credits`),
      apiFetch(`/movie/${id}/videos`),
      apiFetch(`/movie/${id}/similar`),
    ]);

    const trailer   = (videos.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const genres    = (details.genres || []).map(g => `<span class="genre-badge">${escHtml(g.name)}</span>`).join('');
    const director  = (credits.crew || []).find(c => c.job === 'Director');
    const topCast   = (credits.cast || []).slice(0, 8);
    const isFav     = favorites.some(f => f.id === id);
    const isWatched = watchedList.includes(id);
    const myRating  = personalRatings[id] || 0;
    const backdrop  = IMG(details.backdrop_path, 'w1280');
    const poster    = IMG(details.poster_path) || FALLBACK;

    // Cast with photos
    const castHtml = topCast.map(c => `
      <div class="modal-cast-item" title="${escHtml(c.name)}${c.character ? ' as ' + escHtml(c.character) : ''}">
        <div class="modal-cast-avatar">
          ${c.profile_path
            ? `<img src="${IMG(c.profile_path,'w92')}" alt="${escHtml(c.name)}" loading="lazy">`
            : `<div class="modal-cast-avatar-placeholder">${escHtml(c.name.charAt(0).toUpperCase())}</div>`
          }
        </div>
        <div class="modal-cast-name">${escHtml(c.name)}</div>
        <div class="modal-cast-char">${escHtml((c.character||'').split('/')[0].trim())}</div>
      </div>`).join('');

    // Budget / revenue
    const fmt = n => n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n > 0 ? `$${n.toLocaleString()}` : null;
    const budgetStr = fmt(details.budget);
    const revenueStr = fmt(details.revenue);
    const financeHtml = (budgetStr || revenueStr) ? `
      <div class="modal-finance-row">
        ${budgetStr ? `<div class="modal-finance-item"><span class="modal-finance-label">Budget</span><span class="modal-finance-val">${budgetStr}</span></div>` : ''}
        ${revenueStr ? `<div class="modal-finance-item"><span class="modal-finance-label">Box Office</span><span class="modal-finance-val green">${revenueStr}</span></div>` : ''}
      </div>` : '';

    // Inline my-rating row
    const myRatingHtml = `
      <div class="modal-my-rating">
        <span class="modal-my-rating-label">MY RATING</span>
        <div class="modal-my-stars">
          ${[1,2,3,4,5].map(i => `<button class="modal-star ${i <= myRating ? 'active' : ''}" data-v="${i}">★</button>`).join('')}
        </div>
        <span class="modal-my-rating-text ${myRating ? '' : 'muted'}">${myRating ? RATING_LABELS[myRating] : 'Not rated'}</span>
      </div>`;

    modalBody.innerHTML = `
      ${backdrop ? `<div class="modal-hero-img" style="background-image:url('${backdrop}')"><div class="modal-hero-gradient"></div></div>` : ''}
      <div class="modal-poster-row">
        <div class="modal-poster-img"><img src="${poster}" alt="${escHtml(details.title)}" onerror="this.src='${FALLBACK}'"></div>
        <div class="modal-movie-info">
          <h2 class="modal-movie-title">${escHtml(details.title)}</h2>
          ${director ? `<div class="modal-director">Directed by <strong>${escHtml(director.name)}</strong></div>` : ''}
          ${genres ? `<div class="modal-genres">${genres}</div>` : ''}
          <div class="modal-stats">
            <div class="modal-stat">
              <span class="modal-stat-label">Rating</span>
              <span class="modal-stat-value">
                <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ${toRating(details.vote_average)}<small style="font-size:9px;color:var(--text-muted);font-family:monospace">/10</small>
              </span>
            </div>
            ${details.runtime ? `<div class="modal-stat"><span class="modal-stat-label">Runtime</span><span class="modal-stat-value">${details.runtime} min</span></div>` : ''}
            <div class="modal-stat"><span class="modal-stat-label">Year</span><span class="modal-stat-value">${toYear(details.release_date)}</span></div>
            ${details.original_language ? `<div class="modal-stat"><span class="modal-stat-label">Language</span><span class="modal-stat-value">${details.original_language.toUpperCase()}</span></div>` : ''}
          </div>
          ${myRatingHtml}
          <div class="modal-actions">
            <button class="modal-watchlist-btn ${isFav ? 'added' : ''}" id="modalWatchlistBtn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <span>${isFav ? '✓ In Watchlist' : '+ Watchlist'}</span>
            </button>
            <button class="modal-watched-btn ${isWatched ? 'watched' : ''}" id="modalWatchedBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
              <span>${isWatched ? '✓ Watched' : 'Mark Watched'}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="modal-body-content">
        ${details.overview ? `<p class="modal-overview">${escHtml(details.overview)}</p>` : ''}
        ${financeHtml}
        ${castHtml ? `<h4 class="modal-section-title">Cast</h4><div class="modal-cast-grid">${castHtml}</div>` : ''}
        ${trailer ? `<h4 class="modal-section-title">Trailer</h4><div><iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>` : ''}
      </div>
    `;

    // Inline star rating in modal
    let currentModalRating = myRating;
    modalBody.querySelectorAll('.modal-star').forEach((btn, idx) => {
      btn.addEventListener('mouseenter', () => {
        modalBody.querySelectorAll('.modal-star').forEach((b, i) => b.classList.toggle('hover', i <= idx));
      });
      btn.addEventListener('mouseleave', () => {
        modalBody.querySelectorAll('.modal-star').forEach(b => b.classList.remove('hover'));
      });
      btn.addEventListener('click', () => {
        const v = parseInt(btn.dataset.v);
        currentModalRating = v;
        personalRatings[id] = v;
        localStorage.setItem('mv_ratings', JSON.stringify(personalRatings));
        modalBody.querySelectorAll('.modal-star').forEach((b, i) => b.classList.toggle('active', i < v));
        const txt = modalBody.querySelector('.modal-my-rating-text');
        if (txt) { txt.textContent = RATING_LABELS[v]; txt.classList.remove('muted'); }
        showToast(`Rated "${details.title}" ${v}★`, 'star');
        refreshCardRating(id);
      });
    });

    // Watchlist button
    $('modalWatchlistBtn').addEventListener('click', () => {
      toggleFavorite(details);
      const now = favorites.some(f => f.id === details.id);
      $('modalWatchlistBtn').classList.toggle('added', now);
      $('modalWatchlistBtn').querySelector('span').textContent = now ? '✓ In Watchlist' : '+ Watchlist';
      updateHeroFavBtn(heroCurrentId);
    });

    // Watched button
    $('modalWatchedBtn').addEventListener('click', () => {
      toggleWatched(details.id, details.title);
      const now = watchedList.includes(details.id);
      $('modalWatchedBtn').classList.toggle('watched', now);
      $('modalWatchedBtn').querySelector('span').textContent = now ? '✓ Watched' : 'Mark Watched';
      updateHeroWatchedBtn(heroCurrentId);
      refreshCardWatchedState(details.id);
    });

    renderSimilar(similar.results || [], id);

  } catch(e) {
    modalBody.innerHTML = `<div style="padding:44px;text-align:center;color:var(--text-muted);font-size:13px;font-family:monospace">Could not load film details.</div>`;
    console.error('openModal:', e);
  }
}

function renderSimilar(movies, currentId) {
  const filtered = movies.filter(m => m.poster_path && m.id !== currentId).slice(0, 12);
  if (!filtered.length) {
    similarList.innerHTML = '<div style="padding:16px;font-family:monospace;font-size:11px;color:var(--text-muted);letter-spacing:1px;">No similar films found.</div>';
    return;
  }
  similarList.innerHTML = '';
  filtered.forEach(m => {
    const item = document.createElement('div');
    item.className = 'similar-item';
    item.innerHTML = `
      <img class="similar-poster" src="${IMG(m.poster_path, 'w92') || FALLBACK}" alt="${escHtml(m.title)}" loading="lazy" onerror="this.style.display='none'">
      <div class="similar-info">
        <div class="similar-title">${escHtml(m.title || m.name)}</div>
        <div class="similar-year">${toYear(m.release_date)} · ★ ${toRating(m.vote_average)}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      trackCineScore(m);
      openModal(m.id);
    });
    similarList.appendChild(item);
  });
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  const iframe = modalBody.querySelector('iframe');
  if (iframe) { const s = iframe.src; iframe.src = ''; iframe.src = s; }
}
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

/* =============================================
   SEE ALL MODAL
============================================= */
document.querySelectorAll('.see-all-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const endpoint = btn.dataset.endpoint;
    const label    = btn.dataset.label;
    seeAllTitle.textContent = label;
    seeAllGrid.innerHTML = '';
    seeAllModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    seeAllGrid.innerHTML = Array.from({ length: 20 }, () => `<div class="skeleton"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`).join('');
    try {
      const [p1, p2] = await Promise.all([apiFetch(endpoint, { page: 1 }), apiFetch(endpoint, { page: 2 })]);
      const movies = [...(p1.results || []), ...(p2.results || [])].filter(m => m.poster_path);
      seeAllGrid.innerHTML = '';
      movies.forEach(m => {
        const card = createCard(m, id => { closeSeeAllFn(); openModal(id); });
        card.style.width = '100%';
        seeAllGrid.appendChild(card);
      });
    } catch(e) {
      seeAllGrid.innerHTML = '<p style="color:var(--text-muted);padding:22px;grid-column:1/-1;font-family:monospace;font-size:12px">Failed to load.</p>';
    }
  });
});

function closeSeeAllFn() { seeAllModal.classList.add('hidden'); document.body.style.overflow = ''; }
closeSeeAllBtn.addEventListener('click', closeSeeAllFn);
seeAllBackdrop.addEventListener('click', closeSeeAllFn);

/* =============================================
   SCROLL ARROWS
============================================= */
document.addEventListener('click', e => {
  const arrow = e.target.closest('.scroll-arrow');
  if (!arrow) return;
  const row = $(arrow.dataset.target);
  if (!row) return;
  row.scrollBy({ left: (arrow.classList.contains('left') ? -1 : 1) * 560, behavior: 'smooth' });
});

/* =============================================
   FAVORITES
============================================= */
function saveFavorites() {
  localStorage.setItem('mv_favorites', JSON.stringify(favorites));
  updateFavCount();
}

function updateFavCount() {
  favCountEl.textContent = favorites.length;
}

function toggleFavorite(movie) {
  const idx = favorites.findIndex(f => f.id === movie.id);
  const title = movie.title || movie.name || 'Film';
  if (idx > -1) {
    favorites.splice(idx, 1);
    showToast(`Removed "${title}" from watchlist`, 'info');
  } else {
    favorites.push({ id: movie.id, title, poster_path: movie.poster_path, release_date: movie.release_date });
    showToast(`Added "${title}" to watchlist ♥`, 'heart');
  }
  saveFavorites();
}

/* =============================================
   WATCHED LIST
============================================= */
function saveWatched() {
  localStorage.setItem('mv_watched', JSON.stringify(watchedList));
}

function toggleWatched(movieId, title) {
  const idx = watchedList.indexOf(movieId);
  if (idx > -1) {
    watchedList.splice(idx, 1);
    if (title) showToast(`"${title}" unmarked`, 'info');
  } else {
    watchedList.push(movieId);
    if (title) showToast(`"${title}" marked as watched ✓`, 'success');
    if (cineScore._sessions) cineScore._sessions++;
  }
  saveWatched();
}

function refreshCardWatchedState(movieId) {
  document.querySelectorAll(`.card[data-movie-id="${movieId}"]`).forEach(card => {
    card.classList.toggle('watched-card', watchedList.includes(movieId));
  });
}

/* =============================================
   WATCHLIST PANEL — UPGRADED
============================================= */
let _favTab  = 'all';
let _favSort = 'added';

function renderFavPanel() {
  const watched = favorites.filter(m => watchedList.includes(m.id)).length;
  const total   = favorites.length;
  const pct     = total ? Math.round((watched / total) * 100) : 0;
  const fill = $('favProgressFill');
  const lbl  = $('favProgressLabel');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = total ? `${watched} of ${total} watched (${pct}%)` : 'Nothing added yet';

  if (!total) {
    favList.innerHTML = '<div class="fav-empty">Your watchlist is empty.<br><br>Browse and ♥ any film to add it.</div>';
    return;
  }

  let list = [...favorites];
  if (_favTab === 'watched')   list = list.filter(m => watchedList.includes(m.id));
  if (_favTab === 'unwatched') list = list.filter(m => !watchedList.includes(m.id));
  if (_favSort === 'title')    list.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  else if (_favSort === 'year') list.sort((a,b) => (b.release_date||'').localeCompare(a.release_date||''));
  else list = [...list].reverse();

  if (!list.length) {
    favList.innerHTML = `<div class="fav-empty">No ${_favTab === 'watched' ? 'watched' : 'unwatched'} films yet.</div>`;
    return;
  }

  favList.innerHTML = list.map(m => {
    const isW = watchedList.includes(m.id);
    const myR = personalRatings[m.id];
    return `
      <div class="fav-item ${isW ? 'watched-item' : ''}" data-id="${m.id}">
        <img src="${IMG(m.poster_path,'w92') || FALLBACK}" alt="${escHtml(m.title)}" loading="lazy" onerror="this.src='${FALLBACK}'">
        <div class="fav-item-info">
          <div class="fav-item-title">${escHtml(m.title)}</div>
          <div class="fav-item-year">${toYear(m.release_date)}</div>
          <div class="fav-item-badges">
            ${isW ? `<span class="fav-watched-badge">✓ Watched</span>` : ''}
            ${myR ? `<span class="fav-rating-badge">${'★'.repeat(myR)}</span>` : ''}
          </div>
        </div>
        <button class="fav-remove-btn" data-id="${m.id}" title="Remove">✕</button>
      </div>`;
  }).join('');

  favList.querySelectorAll('.fav-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.fav-remove-btn')) return;
      closeFavPanel();
      openModal(parseInt(item.dataset.id));
    });
  });
  favList.querySelectorAll('.fav-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const removed = favorites.find(f => f.id === id);
      favorites = favorites.filter(f => f.id !== id);
      saveFavorites();
      if (removed) showToast(`Removed "${removed.title}"`, 'info');
      renderFavPanel();
      updateHeroFavBtn(heroCurrentId);
    });
  });
}

document.querySelectorAll('.fav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); _favTab = btn.dataset.tab; renderFavPanel();
  });
});
document.querySelectorAll('.fav-sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fav-sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); _favSort = btn.dataset.sort; renderFavPanel();
  });
});

function openFavPanel() { renderFavPanel(); favPanel.classList.remove('hidden'); favOverlay.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeFavPanel() { favPanel.classList.add('hidden'); favOverlay.classList.add('hidden'); document.body.style.overflow = ''; }
favBtn.addEventListener('click', openFavPanel);
$('closeFav').addEventListener('click', closeFavPanel);
favOverlay.addEventListener('click', closeFavPanel);

/* =============================================
   CINESCORE TRACKING
============================================= */
function trackCineScore(movie) {
  if (!cineScore.genres) cineScore.genres = {};
  if (!cineScore.sessions) cineScore.sessions = 0;
  cineScore.sessions++;
  (movie.genre_ids || []).forEach(gid => {
    cineScore.genres[gid] = (cineScore.genres[gid] || 0) + 1;
  });
  localStorage.setItem('mv_cinescore', JSON.stringify(cineScore));
}

function renderCineScore() {
  const genres = cineScore.genres || {};
  const sessions = cineScore.sessions || 0;
  const genreEntries = Object.entries(genres).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const maxVal = genreEntries[0]?.[1] || 1;

  // Tagline
  const topGenreId = genreEntries[0]?.[0];
  const topGenreName = getGenreName(parseInt(topGenreId)) || 'Cinema';
  const taglines = [
    `Your soul leans toward ${topGenreName}. The Oracle sees you.`,
    `A ${topGenreName} devotee with refined taste. Rare.`,
    `The films speak. You listen. Especially to ${topGenreName}.`,
  ];
  $('csTagline').textContent = sessions > 0 ? taglines[sessions % taglines.length] : 'Explore films to build your taste profile.';

  if (genreEntries.length === 0) {
    $('csGenres').innerHTML = '<div style="font-family:monospace;font-size:11px;color:var(--text-muted);letter-spacing:1px;">Open some films to build your profile.</div>';
  } else {
    $('csGenres').innerHTML = genreEntries.map(([gid, count]) => `
      <div class="cs-genre-row">
        <div class="cs-genre-label">
          <span>${getGenreName(parseInt(gid)) || 'Other'}</span>
          <span>${count} film${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="cs-bar-track">
          <div class="cs-bar-fill" style="width:${Math.round((count/maxVal)*100)}%"></div>
        </div>
      </div>
    `).join('');
  }

  $('csStats').innerHTML = `
    <div class="cs-stat"><span class="cs-stat-label">Films Explored</span><span class="cs-stat-value">${sessions}</span></div>
    <div class="cs-stat"><span class="cs-stat-label">In Watchlist</span><span class="cs-stat-value">${favorites.length}</span></div>
    <div class="cs-stat"><span class="cs-stat-label">Marked Watched</span><span class="cs-stat-value">${watchedList.length}</span></div>
    <div class="cs-stat"><span class="cs-stat-label">Genres Explored</span><span class="cs-stat-value">${Object.keys(genres).length}</span></div>
  `;
}

function openCineScore() {
  renderCineScore();
  cineScorePanel.classList.remove('hidden');
  cineScoreOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeCineScore() { cineScorePanel.classList.add('hidden'); cineScoreOverlay.classList.add('hidden'); document.body.style.overflow = ''; }
cineScoreBtn.addEventListener('click', openCineScore);
$('closeCineScore').addEventListener('click', closeCineScore);
cineScoreOverlay.addEventListener('click', closeCineScore);

/* =============================================
   ORACLE — TONIGHT'S PICK
============================================= */
let oraclePickedMovie = null;

oracleBtn.addEventListener('click', () => {
  oracleModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  oracleResult.classList.add('hidden');
  oracleReel.innerHTML = '<div class="oracle-spinning">Consulting the Oracle…</div>';
});

oracleSpinBtn.addEventListener('click', async () => {
  oracleResult.classList.add('hidden');
  oracleSpinBtn.classList.add('spinning');
  oracleSpinBtn.textContent = 'READING THE STARS…';

  // Cycling animation
  const filmTitles = ['Persona', 'Stalker', 'Mulholland Drive', 'The Mirror', 'Synecdoche NY', 'Tree of Life', '2001: A Space Odyssey', 'Akira', 'Nostalghia'];
  let cycleCount = 0;
  const cycle = setInterval(() => {
    oracleReel.innerHTML = `<div class="oracle-spinning">${filmTitles[cycleCount % filmTitles.length]}</div>`;
    cycleCount++;
  }, 120);

  try {
    const page = Math.floor(Math.random() * 20) + 1;
    const data = await apiFetch('/discover/movie', {
      sort_by: 'popularity.desc',
      'vote_count.gte': 1000,
      page,
    });
    const movies = (data.results || []).filter(m => m.poster_path && m.overview);
    await new Promise(r => setTimeout(r, 1800)); // Drama pause
    clearInterval(cycle);

    const movie = movies[Math.floor(Math.random() * movies.length)];
    oraclePickedMovie = movie;

    oracleReel.innerHTML = '';
    oracleResult.classList.remove('hidden');
    oracleResult.innerHTML = `
      <div class="oracle-result-card">
        <img src="${IMG(movie.poster_path, 'w185') || FALLBACK}" alt="${escHtml(movie.title)}" onerror="this.src='${FALLBACK}'">
        <div class="oracle-result-info">
          <div class="oracle-result-title">${escHtml(movie.title)}</div>
          <div class="oracle-result-meta">${toYear(movie.release_date)} · ★ ${toRating(movie.vote_average)}</div>
          <div class="oracle-result-overview">${escHtml(movie.overview)}</div>
        </div>
      </div>
      <button class="oracle-open-btn" id="oracleOpenBtn">Open Full Details</button>
    `;
    $('oracleOpenBtn').addEventListener('click', () => {
      closeOracleModal();
      trackCineScore(movie);
      openModal(movie.id);
    });
  } catch(e) {
    clearInterval(cycle);
    oracleReel.innerHTML = '<div class="oracle-spinning" style="color:var(--red)">The Oracle is silent. Try again.</div>';
  }

  oracleSpinBtn.classList.remove('spinning');
  oracleSpinBtn.textContent = 'SPIN AGAIN';
});

function closeOracleModal() { oracleModal.classList.add('hidden'); document.body.style.overflow = ''; }
oracleClose.addEventListener('click', closeOracleModal);
oracleBackdrop.addEventListener('click', closeOracleModal);

/* =============================================
   COMPARE MODE
============================================= */
compareToggleBtn.addEventListener('click', () => {
  compareMode = !compareMode;
  compareToggleBtn.classList.toggle('active', compareMode);
  document.body.classList.toggle('compare-mode', compareMode);
  compareBar.classList.toggle('hidden', !compareMode);
  if (!compareMode) { compareItems = [null, null]; updateCompareSlots(); }
});

function addToCompare(movie, cardEl) {
  if (!compareMode) return;
  // Already in compare?
  const existing = compareItems.findIndex(c => c && c.id === movie.id);
  if (existing > -1) {
    compareItems[existing] = null;
    cardEl.classList.remove('in-compare');
    updateCompareSlots();
    return;
  }
  const slot = compareItems.findIndex(c => c === null);
  if (slot === -1) {
    // Replace slot 0
    const oldId = compareItems[0]?.id;
    if (oldId) document.querySelectorAll(`.card[data-movie-id="${oldId}"]`).forEach(c => c.classList.remove('in-compare'));
    compareItems[0] = compareItems[1];
    compareItems[1] = movie;
  } else {
    compareItems[slot] = movie;
  }
  cardEl.classList.add('in-compare');
  updateCompareSlots();
}

function updateCompareSlots() {
  [compareSlot1, compareSlot2].forEach((slot, i) => {
    const movie = compareItems[i];
    if (movie) {
      slot.classList.add('filled');
      slot.innerHTML = `
        <img src="${IMG(movie.poster_path, 'w92') || FALLBACK}" onerror="this.style.display='none'">
        <span class="compare-slot-title">${escHtml(movie.title)}</span>
        <button class="compare-slot-remove" data-slot="${i}">✕</button>
      `;
      slot.querySelector('.compare-slot-remove').addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.slot);
        if (compareItems[idx]) {
          const mid = compareItems[idx].id;
          document.querySelectorAll(`.card[data-movie-id="${mid}"]`).forEach(c => c.classList.remove('in-compare'));
        }
        compareItems[idx] = null;
        updateCompareSlots();
      });
    } else {
      slot.classList.remove('filled');
      slot.innerHTML = `<span class="compare-slot-placeholder">+ Add a film</span>`;
    }
  });
  compareNowBtn.disabled = !(compareItems[0] && compareItems[1]);
}

compareNowBtn.addEventListener('click', async () => {
  if (!compareItems[0] || !compareItems[1]) return;
  openCompareModal(compareItems[0], compareItems[1]);
});

clearCompareBtn.addEventListener('click', () => {
  compareItems.forEach(m => {
    if (m) document.querySelectorAll(`.card[data-movie-id="${m.id}"]`).forEach(c => c.classList.remove('in-compare'));
  });
  compareItems = [null, null];
  updateCompareSlots();
});

async function openCompareModal(m1, m2) {
  compareModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  compareGrid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;font-family:monospace;font-size:11px;color:var(--text-muted);letter-spacing:1px">Loading comparison…</div>`;

  try {
    const [d1, d2] = await Promise.all([
      apiFetch(`/movie/${m1.id}`),
      apiFetch(`/movie/${m2.id}`),
    ]);

    const ratingWinner = d1.vote_average >= d2.vote_average ? [true, false] : [false, true];
    const runtimeWinner = (d1.runtime || 0) <= (d2.runtime || 0) ? [true, false] : [false, true];

    const buildCol = (d, rWin, runWin) => `
      <div class="compare-col">
        <div class="compare-poster-wrap">
          <img src="${IMG(d.poster_path) || FALLBACK}" alt="${escHtml(d.title)}" onerror="this.src='${FALLBACK}'">
          <div class="compare-film-year">${toYear(d.release_date)}</div>
        </div>
        <div class="compare-col-title">${escHtml(d.title)}</div>
        <div class="compare-stat-row">
          <span class="compare-stat-val ${rWin ? 'winner' : ''}">★ ${toRating(d.vote_average)}</span>
        </div>
        <div class="compare-stat-row">
          <span class="compare-stat-val ${runWin ? 'winner' : ''}">${d.runtime ? d.runtime + ' min' : '—'}</span>
        </div>
        <div class="compare-stat-row">
          <span class="compare-stat-val">${(d.genres || []).map(g => g.name).slice(0,2).join(', ') || '—'}</span>
        </div>
        <div class="compare-stat-row">
          <span class="compare-stat-val">${d.vote_count ? d.vote_count.toLocaleString() + ' votes' : '—'}</span>
        </div>
        <div class="compare-stat-row">
          <span class="compare-stat-val">${d.original_language?.toUpperCase() || '—'}</span>
        </div>
      </div>
    `;

    compareGrid.innerHTML = `
      ${buildCol(d1, ratingWinner[0], runtimeWinner[0])}
      <div class="compare-vs-center" style="display:flex;align-items:center;justify-content:center;padding:0 16px;font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text-muted);">
        <div>
          <div style="margin-bottom:14px;font-size:10px;font-family:monospace;letter-spacing:1px;color:var(--text-muted)">RATING</div>
          <div style="margin-bottom:14px;font-size:10px;font-family:monospace;letter-spacing:1px;color:var(--text-muted)">RUNTIME</div>
          <div style="margin-bottom:14px;font-size:10px;font-family:monospace;letter-spacing:1px;color:var(--text-muted)">GENRE</div>
          <div style="margin-bottom:14px;font-size:10px;font-family:monospace;letter-spacing:1px;color:var(--text-muted)">VOTES</div>
          <div style="font-size:10px;font-family:monospace;letter-spacing:1px;color:var(--text-muted)">LANG</div>
        </div>
      </div>
      ${buildCol(d2, ratingWinner[1], runtimeWinner[1])}
    `;
  } catch(e) {
    compareGrid.innerHTML = '<p style="color:var(--text-muted);padding:24px;grid-column:1/-1;font-family:monospace;font-size:12px">Failed to load comparison.</p>';
  }
}

closeCompareBtn.addEventListener('click', () => { compareModal.classList.add('hidden'); document.body.style.overflow = ''; });
compareBackdrop.addEventListener('click', () => { compareModal.classList.add('hidden'); document.body.style.overflow = ''; });

/* =============================================
   SEARCH
============================================= */
const searchTriggerBtn    = $('searchTriggerBtn');
const searchModal         = $('searchModal');
const searchModalBackdrop = $('searchModalBackdrop');
const searchModalClose    = $('searchModalClose');
const searchEmptyState    = $('searchEmptyState');
const searchResultsList   = $('searchResultsList');
const searchLoadingEl     = $('searchLoading');
const searchNoResults     = $('searchNoResults');
const searchNoResultsText = $('searchNoResultsText');
const searchFooterCount   = $('searchFooterCount');
const searchInput         = $('search');
const searchClear         = $('searchClear');

let searchResults = [], focusedIdx = -1, searchTimer = null, lastQuery = '';

function openSearchModal() {
  searchModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  showState('empty');
  searchInput.value = '';
  searchClear.classList.add('hidden');
  focusedIdx = -1; lastQuery = '';
  requestAnimationFrame(() => searchInput.focus());
}
function closeSearchModal() { searchModal.classList.add('hidden'); document.body.style.overflow = ''; clearTimeout(searchTimer); }

function showState(state) {
  [searchEmptyState, searchResultsList, searchLoadingEl, searchNoResults, searchFooterCount].forEach(el => el.classList.add('hidden'));
  if (state === 'empty')   searchEmptyState.classList.remove('hidden');
  if (state === 'loading') searchLoadingEl.classList.remove('hidden');
  if (state === 'results') { searchResultsList.classList.remove('hidden'); searchFooterCount.classList.remove('hidden'); }
  if (state === 'none')    searchNoResults.classList.remove('hidden');
}

function highlight(text, query) {
  if (!query) return escHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function renderSearchResults(movies, query) {
  searchResults = movies; focusedIdx = -1;
  searchResultsList.innerHTML = '';
  if (!movies.length) { showState('none'); searchNoResultsText.textContent = `No results for "${query}"`; return; }
  showState('results');
  searchFooterCount.textContent = `${movies.length} result${movies.length !== 1 ? 's' : ''}`;
  movies.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('tabindex', '-1');
    item.dataset.idx = i;
    item.innerHTML = `
      <img class="search-result-poster" src="${IMG(m.poster_path, 'w92')}" alt="${escHtml(m.title)}" loading="lazy" onerror="this.style.display='none'">
      <div class="search-result-info">
        <div class="search-result-title">${highlight(m.title, query)}</div>
        <div class="search-result-meta">
          <span>${toYear(m.release_date)}</span>
          ${m.vote_average > 0 ? `<span class="search-result-star"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${toRating(m.vote_average)}</span>` : ''}
          ${m.genre_ids?.[0] ? `<span style="opacity:.55">${getGenreName(m.genre_ids[0])}</span>` : ''}
        </div>
      </div>
      <div class="search-result-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>
    `;
    item.addEventListener('click', () => selectResult(m));
    item.addEventListener('mouseenter', () => setFocus(i));
    searchResultsList.appendChild(item);
  });
  const seeAllRow = document.createElement('div');
  seeAllRow.className = 'search-see-all-row';
  seeAllRow.innerHTML = `<span class="search-see-all-text">See all for <strong>"${escHtml(query)}"</strong></span><span class="search-see-all-badge">Full search</span>`;
  seeAllRow.addEventListener('click', () => { closeSearchModal(); openSearchResultsModal(query); });
  searchResultsList.appendChild(seeAllRow);
}

function setFocus(idx) {
  searchResultsList.querySelectorAll('.search-result-item').forEach((el, i) => el.classList.toggle('focused', i === idx));
  focusedIdx = idx;
}

function selectResult(movie) { closeSearchModal(); trackCineScore(movie); openModal(movie.id); }

async function doSearch(q) {
  if (q === lastQuery) return;
  lastQuery = q;
  showState('loading');
  try {
    const data = await apiFetch('/search/movie', { query: q, page: 1 });
    if (q !== searchInput.value.trim()) return;
    renderSearchResults((data.results || []).filter(m => m.poster_path).slice(0, 8), q);
  } catch(e) {
    showState('none');
    searchNoResultsText.textContent = 'Search unavailable.';
  }
}

searchTriggerBtn.addEventListener('click', openSearchModal);
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.classList.toggle('hidden', q.length === 0);
  if (!q) { showState('empty'); lastQuery = ''; clearTimeout(searchTimer); return; }
  if (q.length < 2) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(q), 280);
});
searchClear.addEventListener('click', () => { searchInput.value = ''; searchClear.classList.add('hidden'); showState('empty'); lastQuery = ''; clearTimeout(searchTimer); searchInput.focus(); });
searchInput.addEventListener('keydown', e => {
  const items = searchResultsList.querySelectorAll('.search-result-item');
  const count = items.length;
  if (e.key === 'ArrowDown') { e.preventDefault(); const n = (focusedIdx + 1) % count; setFocus(n); items[n]?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); const p = focusedIdx <= 0 ? count - 1 : focusedIdx - 1; setFocus(p); items[p]?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') {
    if (focusedIdx >= 0 && focusedIdx < searchResults.length) selectResult(searchResults[focusedIdx]);
    else if (searchInput.value.trim().length >= 2) { closeSearchModal(); openSearchResultsModal(searchInput.value.trim()); }
  }
});
searchModalBackdrop.addEventListener('click', closeSearchModal);
searchModalClose.addEventListener('click', closeSearchModal);

async function openSearchResultsModal(q) {
  seeAllTitle.textContent = `Search: "${q}"`;
  seeAllGrid.innerHTML = '';
  seeAllModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  seeAllGrid.innerHTML = Array.from({ length: 12 }, () => `<div class="skeleton"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`).join('');
  try {
    const data = await apiFetch('/search/movie', { query: q, page: 1 });
    const movies = (data.results || []).filter(m => m.poster_path);
    seeAllGrid.innerHTML = '';
    movies.forEach(m => { const c = createCard(m, id => { closeSeeAllFn(); openModal(id); }); c.style.width = '100%'; seeAllGrid.appendChild(c); });
    if (!movies.length) seeAllGrid.innerHTML = '<p style="color:var(--text-muted);padding:18px;grid-column:1/-1;font-family:monospace;font-size:12px">No results found.</p>';
  } catch(e) {
    seeAllGrid.innerHTML = '<p style="color:var(--text-muted);padding:18px;grid-column:1/-1;font-family:monospace;font-size:12px">Search failed.</p>';
  }
}

/* =============================================
   MOOD MATCHER
============================================= */
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const genres = btn.dataset.genres;
    const label  = btn.dataset.label;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    moodResults.classList.remove('hidden');
    moodResultsLabel.innerHTML = `Films for: <em>${escHtml(label)}</em>`;
    renderSkeletons('moodMovies', 10);
    setTimeout(() => moodResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    try {
      const data = await apiFetch('/discover/movie', {
        with_genres: genres,
        sort_by: 'vote_count.desc',
        'vote_average.gte': 6.5,
        'vote_count.gte': 500,
        page: Math.floor(Math.random() * 5) + 1,
      });
      displayMovies((data.results || []).filter(m => m.poster_path), 'moodMovies');
    } catch(e) {
      moodMovies.innerHTML = '<p style="color:var(--text-muted);padding:18px;font-size:12px;font-family:monospace">Failed to load.</p>';
    }
  });
});

/* =============================================
   COMPARE SEARCH
============================================= */
const compareSearchInput   = $('compareSearchInput');
const compareSearchClear   = $('compareSearchClear');
const compareSearchResults = $('compareSearchResults');

let compareSearchTimer = null;
let compareSearchFocusIdx = -1;
let compareSearchItems = [];

compareSearchInput.addEventListener('input', () => {
  const q = compareSearchInput.value.trim();
  compareSearchClear.classList.toggle('hidden', q.length === 0);
  compareSearchResults.classList.add('hidden');
  compareSearchItems = [];
  if (q.length < 2) { clearTimeout(compareSearchTimer); return; }
  clearTimeout(compareSearchTimer);
  compareSearchTimer = setTimeout(() => doCompareSearch(q), 280);
});

compareSearchClear.addEventListener('click', () => {
  compareSearchInput.value = '';
  compareSearchClear.classList.add('hidden');
  compareSearchResults.classList.add('hidden');
  compareSearchItems = [];
  compareSearchInput.focus();
});

compareSearchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    compareSearchResults.classList.add('hidden');
    compareSearchInput.blur();
    return;
  }
  const items = compareSearchResults.querySelectorAll('.compare-search-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    compareSearchFocusIdx = Math.min(compareSearchFocusIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('focused', i === compareSearchFocusIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    compareSearchFocusIdx = Math.max(compareSearchFocusIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('focused', i === compareSearchFocusIdx));
  } else if (e.key === 'Enter' && compareSearchFocusIdx >= 0 && compareSearchItems[compareSearchFocusIdx]) {
    addMovieToCompareFromSearch(compareSearchItems[compareSearchFocusIdx]);
  }
});

// Close when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.compare-search-wrap')) {
    compareSearchResults.classList.add('hidden');
  }
});

async function doCompareSearch(q) {
  compareSearchFocusIdx = -1;
  compareSearchResults.innerHTML = `<div class="compare-search-loading"><div class="search-spinner"></div>Searching…</div>`;
  compareSearchResults.classList.remove('hidden');
  try {
    const data = await apiFetch('/search/movie', { query: q, page: 1 });
    const movies = (data.results || []).filter(m => m.poster_path).slice(0, 6);
    compareSearchItems = movies;
    if (!movies.length) {
      compareSearchResults.innerHTML = `<div class="compare-search-loading">No results found.</div>`;
      return;
    }
    compareSearchResults.innerHTML = '';
    movies.forEach((m, i) => {
      const item = document.createElement('div');
      item.className = 'compare-search-item';
      const alreadyIn = compareItems.some(c => c && c.id === m.id);
      item.innerHTML = `
        <img src="${IMG(m.poster_path, 'w92') || FALLBACK}" alt="${escHtml(m.title)}" onerror="this.style.display='none'">
        <div class="compare-search-item-info">
          <div class="compare-search-item-title">${escHtml(m.title)}</div>
          <div class="compare-search-item-year">${toYear(m.release_date)} · ★ ${toRating(m.vote_average)}</div>
        </div>
        <span class="compare-search-item-add">${alreadyIn ? '✓ Added' : '+ Add'}</span>
      `;
      if (!alreadyIn) {
        item.addEventListener('click', () => addMovieToCompareFromSearch(m));
      }
      compareSearchResults.appendChild(item);
    });
  } catch(e) {
    compareSearchResults.innerHTML = `<div class="compare-search-loading">Search failed.</div>`;
  }
}

function addMovieToCompareFromSearch(movie) {
  if (compareItems.some(c => c && c.id === movie.id)) return;
  const slot = compareItems.findIndex(c => c === null);
  if (slot === -1) {
    const oldId = compareItems[0]?.id;
    if (oldId) document.querySelectorAll(`.card[data-movie-id="${oldId}"]`).forEach(c => c.classList.remove('in-compare'));
    compareItems[0] = compareItems[1];
    compareItems[1] = movie;
  } else {
    compareItems[slot] = movie;
  }
  updateCompareSlots();
  // Clear search
  compareSearchInput.value = '';
  compareSearchClear.classList.add('hidden');
  compareSearchResults.classList.add('hidden');
  compareSearchItems = [];
  // Quick flash on bar
  compareBar.style.borderTopColor = 'rgba(100,160,255,0.6)';
  setTimeout(() => compareBar.style.borderTopColor = '', 600);
}

/* =============================================
   CAST EXPLORER
============================================= */
const castSearchInput   = $('castSearchInput');
const castAutocomplete  = $('castAutocomplete');
const castActiveChips   = $('castActiveChips');
const castFindBtn       = $('castFindBtn');
const castClearBtn      = $('castClearBtn');
const castResults       = $('castResults');
const castResultsLabel  = $('castResultsLabel');
const castMovies        = $('castMovies');

let selectedCast = []; // [{id, name, photo}]
let castSearchTimer = null;
let castAutoFocusIdx = -1;
let castAutoItems = [];

castSearchInput.addEventListener('input', () => {
  const q = castSearchInput.value.trim();
  if (q.length < 2) { castAutocomplete.classList.add('hidden'); clearTimeout(castSearchTimer); return; }
  clearTimeout(castSearchTimer);
  castSearchTimer = setTimeout(() => doCastSearch(q), 300);
});

castSearchInput.addEventListener('keydown', e => {
  const items = castAutocomplete.querySelectorAll('.cast-autocomplete-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    castAutoFocusIdx = Math.min(castAutoFocusIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('focused', i === castAutoFocusIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    castAutoFocusIdx = Math.max(castAutoFocusIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('focused', i === castAutoFocusIdx));
  } else if (e.key === 'Enter') {
    if (castAutoFocusIdx >= 0 && castAutoItems[castAutoFocusIdx]) {
      addCastMember(castAutoItems[castAutoFocusIdx]);
    } else if (q.length >= 2) {
      doCastSearch(castSearchInput.value.trim());
    }
  } else if (e.key === 'Escape') {
    castAutocomplete.classList.add('hidden');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.cast-chips-wrap')) castAutocomplete.classList.add('hidden');
});

async function doCastSearch(q) {
  castAutoFocusIdx = -1;
  castAutocomplete.innerHTML = `<div class="cast-autocomplete-loading"><div class="search-spinner" style="width:12px;height:12px;border-width:1.5px;"></div>Searching people…</div>`;
  castAutocomplete.classList.remove('hidden');

  try {
    const data = await apiFetch('/search/person', { query: q, page: 1 });
    const people = (data.results || []).filter(p => p.known_for_department === 'Acting').slice(0, 6);
    castAutoItems = people;

    if (!people.length) {
      castAutocomplete.innerHTML = `<div class="cast-autocomplete-loading">No actors found.</div>`;
      return;
    }

    castAutocomplete.innerHTML = '';
    people.forEach((person, i) => {
      if (selectedCast.some(c => c.id === person.id)) return; // skip already added
      const item = document.createElement('div');
      item.className = 'cast-autocomplete-item';
      const photo = person.profile_path ? IMG(person.profile_path, 'w92') : FALLBACK;
      item.innerHTML = `
        <img class="cast-autocomplete-avatar" src="${photo}" alt="${escHtml(person.name)}" onerror="this.src='${FALLBACK}'">
        <div class="cast-autocomplete-info">
          <div class="cast-autocomplete-name">${escHtml(person.name)}</div>
          <div class="cast-autocomplete-known">${escHtml((person.known_for || []).slice(0,2).map(k => k.title || k.name).join(', '))}</div>
        </div>
        <span class="cast-autocomplete-add">+ Add</span>
      `;
      item.addEventListener('click', () => addCastMember(person));
      castAutocomplete.appendChild(item);
    });

    if (!castAutocomplete.children.length) {
      castAutocomplete.innerHTML = `<div class="cast-autocomplete-loading">All matching actors already added.</div>`;
    }
  } catch(e) {
    castAutocomplete.innerHTML = `<div class="cast-autocomplete-loading">Search failed.</div>`;
  }
}

function addCastMember(person) {
  if (selectedCast.some(c => c.id === person.id)) return;
  const photo = person.profile_path ? IMG(person.profile_path, 'w92') : FALLBACK;
  selectedCast.push({ id: person.id, name: person.name, photo });

  // Render chip
  const chip = document.createElement('div');
  chip.className = 'cast-chip-active';
  chip.dataset.personId = person.id;
  chip.innerHTML = `
    <img class="cast-chip-avatar" src="${photo}" alt="${escHtml(person.name)}" onerror="this.src='${FALLBACK}'">
    <span class="cast-chip-name">${escHtml(person.name)}</span>
    <button class="cast-chip-remove" data-id="${person.id}" title="Remove">✕</button>
  `;
  chip.querySelector('.cast-chip-remove').addEventListener('click', () => removeCastMember(person.id));
  castActiveChips.appendChild(chip);

  castSearchInput.value = '';
  castAutocomplete.classList.add('hidden');
  castAutoItems = [];
  castAutoFocusIdx = -1;
  castSearchInput.focus();
  updateCastActionState();
}

function removeCastMember(personId) {
  selectedCast = selectedCast.filter(c => c.id !== personId);
  const chip = castActiveChips.querySelector(`[data-person-id="${personId}"]`);
  if (chip) chip.remove();
  updateCastActionState();
  if (!selectedCast.length) {
    castResults.classList.add('hidden');
  }
}

function updateCastActionState() {
  castFindBtn.disabled = selectedCast.length === 0;
  castClearBtn.classList.toggle('hidden', selectedCast.length === 0);
}

castClearBtn.addEventListener('click', () => {
  selectedCast = [];
  castActiveChips.innerHTML = '';
  castResults.classList.add('hidden');
  updateCastActionState();
});

castFindBtn.addEventListener('click', async () => {
  if (!selectedCast.length) return;

  castResults.classList.remove('hidden');

  // Build label chips (count set per-branch below)
  const nameChips = selectedCast.map(c =>
    `<span class="cast-results-tag">${escHtml(c.name)}</span>`
  ).join('');

  renderSkeletons('castMovies', 10);

  // Smooth scroll
  setTimeout(() => castResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

  try {
    // Get each person's movie credits in parallel
    const creditsPromises = selectedCast.map(c =>
      apiFetch(`/person/${c.id}/movie_credits`)
    );
    const allCredits = await Promise.all(creditsPromises);

    if (selectedCast.length === 1) {
      // Single actor — show ALL their movies with a poster, sorted by popularity
      const movies = (allCredits[0].cast || [])
        .filter(m => m.poster_path)
        .sort((a, b) => b.popularity - a.popularity);
      displayMovies(movies, 'castMovies');
      castResultsLabel.innerHTML = `All ${movies.length} film${movies.length !== 1 ? 's' : ''} featuring ${nameChips}`;
    } else {
      // Multiple actors — find intersection (movies they ALL share)
      const movieSets = allCredits.map(credits =>
        new Set((credits.cast || []).map(m => m.id))
      );
      const sharedIds = [...movieSets[0]].filter(id =>
        movieSets.every(set => set.has(id))
      );

      if (!sharedIds.length) {
        castMovies.innerHTML = `<div class="cast-no-results">No films found where all selected actors appear together. Try fewer names.</div>`;
        return;
      }

      // Pull full details for every shared film (to get poster + vote data)
      const sharedMovies = (allCredits[0].cast || [])
        .filter(m => sharedIds.includes(m.id) && m.poster_path)
        .sort((a, b) => b.popularity - a.popularity);

      displayMovies(sharedMovies, 'castMovies');
      castResultsLabel.innerHTML = `${sharedMovies.length} film${sharedMovies.length !== 1 ? 's' : ''} featuring ${nameChips}`;
    }
  } catch(e) {
    castMovies.innerHTML = `<div class="cast-no-results">Failed to load. Please try again.</div>`;
    console.error('castFinder:', e);
  }
});

/* =============================================
   KEYBOARD SHORTCUTS
============================================= */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('ratingModal').classList.contains('hidden'))    { closeRatingModal(); return; }
    if (!searchModal.classList.contains('hidden'))        { closeSearchModal(); return; }
    if (!oracleModal.classList.contains('hidden'))        { closeOracleModal(); return; }
    if (!modal.classList.contains('hidden'))              { closeModal(); return; }
    if (!seeAllModal.classList.contains('hidden'))        { closeSeeAllFn(); return; }
    if (!compareModal.classList.contains('hidden'))       { compareModal.classList.add('hidden'); document.body.style.overflow = ''; return; }
    if (!favPanel.classList.contains('hidden'))           { closeFavPanel(); return; }
    if (!cineScorePanel.classList.contains('hidden'))     { closeCineScore(); return; }
  }
  if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault(); openSearchModal();
  }
});

/* =============================================
   WORLD CINEMA — REGION-BASED FILTER
============================================= */
const LANG_LABELS = {
  en: 'Hollywood', ko: 'Korean Cinema', ja: 'Japanese Cinema', fr: 'French Cinema',
  hi: 'Bollywood', es: 'Spanish Cinema', it: 'Italian Cinema', zh: 'Chinese Cinema',
  de: 'German Cinema', pt: 'Brazilian Cinema', tr: 'Turkish Cinema', ru: 'Russian Cinema'
};

// Auto-detect region from browser locale
function detectUserRegion() {
  const locale = navigator.language || 'en-US';
  const langCode = locale.split('-')[0].toLowerCase();
  const regionMap = {
    ko: { lang: 'ko', region: 'KR', label: '🇰🇷 Korean' },
    ja: { lang: 'ja', region: 'JP', label: '🇯🇵 Japanese' },
    fr: { lang: 'fr', region: 'FR', label: '🇫🇷 French' },
    hi: { lang: 'hi', region: 'IN', label: '🇮🇳 Bollywood' },
    es: { lang: 'es', region: 'ES', label: '🇪🇸 Spanish' },
    it: { lang: 'it', region: 'IT', label: '🇮🇹 Italian' },
    zh: { lang: 'zh', region: 'CN', label: '🇨🇳 Chinese' },
    de: { lang: 'de', region: 'DE', label: '🇩🇪 German' },
    pt: { lang: 'pt', region: 'BR', label: '🇧🇷 Brazilian' },
    tr: { lang: 'tr', region: 'TR', label: '🇹🇷 Turkish' },
    ru: { lang: 'ru', region: 'RU', label: '🇷🇺 Russian' }
  };
  return regionMap[langCode] || null;
}

async function loadWorldCinema(lang, label) {
  $('worldCinemaLabel').textContent = label;
  renderSkeletons('worldCinemaRow', 10);
  try {
    const data = await apiFetch('/discover/movie', {
      with_original_language: lang,
      sort_by: 'popularity.desc',
      'vote_count.gte': lang === 'en' ? 500 : 100,
      page: 1
    });
    displayMovies(data.results, 'worldCinemaRow');
  } catch(e) {
    $('worldCinemaRow').innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">Failed to load.</p>';
  }
}

function initWorldCinema() {
  const detected = detectUserRegion();
  const badge = $('regionDetectBadge');

  // If user's language matches a non-English region, auto-select it
  if (detected && detected.lang !== 'en') {
    const matchBtn = document.querySelector(`.region-flag-btn[data-lang="${detected.lang}"]`);
    if (matchBtn) {
      document.querySelectorAll('.region-flag-btn').forEach(b => b.classList.remove('active'));
      matchBtn.classList.add('active');
      badge.textContent = `📍 Auto-detected: ${detected.label}`;
      badge.classList.remove('hidden');
      loadWorldCinema(detected.lang, `${detected.label} · Most Popular`);
      return;
    }
  }

  // Default: English / Hollywood
  loadWorldCinema('en', 'Hollywood · Most Popular');
}

document.querySelectorAll('.region-flag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.region-flag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('regionDetectBadge').classList.add('hidden');
    loadWorldCinema(btn.dataset.lang, btn.dataset.label + ' · Most Popular');
  });
});

/* =============================================
   DECADE TIME MACHINE
============================================= */
async function loadDecade(decade, label) {
  $('decadeLabel').textContent = label;
  renderSkeletons('decadeRow', 10);
  try {
    const from = `${decade}-01-01`;
    const to = `${decade + 9}-12-31`;
    const data = await apiFetch('/discover/movie', {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 500,
      'primary_release_date.gte': from,
      'primary_release_date.lte': to,
      page: 1
    });
    displayMovies(data.results, 'decadeRow');
  } catch(e) {
    $('decadeRow').innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">Failed to load.</p>';
  }
}

function initDecadeMachine() {
  loadDecade(1990, 'The 90s · Indie Revolution');
}

document.querySelectorAll('.decade-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.decade-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadDecade(parseInt(btn.dataset.decade), btn.dataset.label);
  });
});

/* =============================================
   POSTER GUESSER GAME
============================================= */
let guesserState = {
  movie: null,
  options: [],
  hintsRevealed: 0,
  maxHints: 3,
  blurLevel: 20,
  streak: parseInt(localStorage.getItem('guesser_streak') || '0'),
  answered: false
};

const BLUR_LEVELS = [20, 12, 6, 0]; // blur px per reveal step

function updateGuesserStreak() {
  $('guesserStreak').textContent = guesserState.streak;
  localStorage.setItem('guesser_streak', guesserState.streak);
}

async function loadGuesserRound() {
  $('guesserLoading').classList.remove('hidden');
  $('guesserArena').style.opacity = '0.3';
  $('guesserFeedback').classList.add('hidden');

  try {
    const page = Math.floor(Math.random() * 15) + 1;
    const data = await apiFetch('/discover/movie', {
      sort_by: 'popularity.desc',
      'vote_count.gte': 2000,
      page
    });

    const pool = (data.results || []).filter(m => m.poster_path && m.title);
    if (pool.length < 4) { loadGuesserRound(); return; }

    // Pick random correct answer
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const correct = shuffled[0];
    // Build 4 options: correct + 3 wrongs
    const wrong = shuffled.slice(1, 4);
    const allOptions = [correct, ...wrong].sort(() => Math.random() - 0.5);

    guesserState.movie = correct;
    guesserState.options = allOptions;
    guesserState.hintsRevealed = 0;
    guesserState.blurLevel = BLUR_LEVELS[0];
    guesserState.answered = false;

    // Fetch details for hints
    const details = await apiFetch(`/movie/${correct.id}`);
    guesserState.details = details;

    renderGuesserRound();
  } catch(e) {
    console.error('guesser:', e);
  } finally {
    $('guesserLoading').classList.add('hidden');
    $('guesserArena').style.opacity = '1';
    $('guesserArena').style.transition = 'opacity 0.4s';
  }
}

function renderGuesserRound() {
  const { movie, options, blurLevel, hintsRevealed, details } = guesserState;

  // Poster
  const posterEl = $('guesserPoster');
  posterEl.src = IMG(movie.poster_path, 'w342') || FALLBACK;
  posterEl.style.filter = `blur(${blurLevel}px)`;
  posterEl.style.transition = 'filter 0.6s ease';

  // Blur overlay (visual indicator)
  const blurOv = $('guesserBlurOverlay');
  blurOv.style.backdropFilter = blurLevel > 0 ? `blur(${Math.max(0, blurLevel - 2)}px)` : 'none';

  // Reveal progress
  const step = BLUR_LEVELS.indexOf(blurLevel);
  const progress = ((step) / (BLUR_LEVELS.length - 1)) * 100;
  $('guesserRevealProgress').style.width = `${progress}%`;

  // Hints
  const hints = buildHints(details, hintsRevealed);
  $('guesserHints').innerHTML = hints;

  // Options
  $('guesserOptions').innerHTML = options.map(m => `
    <button class="guesser-option" data-id="${m.id}" data-correct="${m.id === movie.id}">
      ${escHtml(m.title)}
    </button>
  `).join('');

  document.querySelectorAll('.guesser-option').forEach(btn => {
    btn.addEventListener('click', () => handleGuesserAnswer(btn));
  });

  // Action buttons
  $('guesserRevealBtn').disabled = hintsRevealed >= guesserState.maxHints || guesserState.answered;
}

function buildHints(details, count) {
  const hints = [
    `Year: ${toYear(details.release_date)}`,
    `Genre: ${(details.genres || []).slice(0,2).map(g => g.name).join(', ') || '?'}`,
    `Rating: ★ ${toRating(details.vote_average)}`,
    `Runtime: ${details.runtime ? details.runtime + ' min' : '?'}`
  ];
  if (count === 0) return `<span class="guesser-hint-locked">🔒 Hints locked — guess now or reveal one</span>`;
  return hints.slice(0, count).map(h => `<div class="guesser-hint-item">💡 ${escHtml(h)}</div>`).join('');
}

function handleGuesserAnswer(btn) {
  if (guesserState.answered) return;
  guesserState.answered = true;

  const isCorrect = btn.dataset.correct === 'true';

  // Reveal all poster
  $('guesserPoster').style.filter = 'blur(0px)';
  $('guesserBlurOverlay').style.backdropFilter = 'none';
  $('guesserRevealProgress').style.width = '100%';

  // Mark buttons
  document.querySelectorAll('.guesser-option').forEach(b => {
    b.disabled = true;
    if (b.dataset.correct === 'true') b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong');
  });

  // Score
  if (isCorrect) {
    guesserState.streak++;
    updateGuesserStreak();
    const pts = Math.max(1, 3 - guesserState.hintsRevealed);
    showGuesserFeedback(true, `✓ Correct! +${pts}pt${pts !== 1 ? 's' : ''} — ${escHtml(guesserState.movie.title)}`);
  } else {
    guesserState.streak = 0;
    updateGuesserStreak();
    showGuesserFeedback(false, `✗ Wrong — It was "${escHtml(guesserState.movie.title)}"`);
  }

  // Show all hints
  $('guesserHints').innerHTML = buildHints(guesserState.details, 4);
  $('guesserRevealBtn').disabled = true;

  // Auto next after delay
  setTimeout(() => loadGuesserRound(), 3500);
}

function showGuesserFeedback(correct, msg) {
  const el = $('guesserFeedback');
  el.className = `guesser-feedback ${correct ? 'correct' : 'wrong'}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

$('guesserRevealBtn').addEventListener('click', () => {
  if (guesserState.hintsRevealed >= guesserState.maxHints || guesserState.answered) return;
  guesserState.hintsRevealed++;
  const newBlurIdx = Math.min(guesserState.hintsRevealed, BLUR_LEVELS.length - 1);
  guesserState.blurLevel = BLUR_LEVELS[newBlurIdx];
  $('guesserPoster').style.filter = `blur(${guesserState.blurLevel}px)`;
  $('guesserBlurOverlay').style.backdropFilter = guesserState.blurLevel > 0 ? `blur(${Math.max(0, guesserState.blurLevel - 2)}px)` : 'none';
  $('guesserHints').innerHTML = buildHints(guesserState.details, guesserState.hintsRevealed);
  const step = BLUR_LEVELS.indexOf(guesserState.blurLevel);
  $('guesserRevealProgress').style.width = `${(step / (BLUR_LEVELS.length - 1)) * 100}%`;
  $('guesserRevealBtn').disabled = guesserState.hintsRevealed >= guesserState.maxHints;
});

$('guesserSkipBtn').addEventListener('click', () => {
  guesserState.streak = 0;
  updateGuesserStreak();
  loadGuesserRound();
});

/* =============================================
   INIT
============================================= */
updateFavCount();
updateGuesserStreak();
loadHero();
loadDirectorsCut();
fetchSection('/trending/movie/day', 'trending');
fetchSection('/movie/top_rated', 'topRated');
fetchSection('/movie/upcoming', 'upcoming');
fetchSection('/movie/now_playing', 'nowPlaying');
initWorldCinema();
initDecadeMachine();
loadGuesserRound();