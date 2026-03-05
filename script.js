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
let _lastModalDetails = null;

const RATING_LABELS = ['', "Didn't Like It", 'It Was OK', 'Liked It', 'Really Liked It', 'Masterpiece ◉'];

/* =============================================
   THEME SYSTEM (Dark / Light / Sepia)
============================================= */
/* =============================================
   DIARY (Film Log)
============================================= */
let filmDiary = JSON.parse(localStorage.getItem('mv_diary') || '[]');
let _diaryPending = null;

function saveDiary() { localStorage.setItem('mv_diary', JSON.stringify(filmDiary)); }

function openDiaryForm(movie) {
  _diaryPending = movie;
  const panel = $('diaryAddPanel');
  panel.classList.remove('hidden');
  $('diaryFormFilm').innerHTML = `
    <div class="diary-form-film-info">
      ${movie.poster_path ? `<img src="${IMG(movie.poster_path,'w92')}" alt="">` : ''}
      <div>
        <div class="diary-form-film-title">${escHtml(movie.title || movie.name)}</div>
        <div class="diary-form-film-year">${toYear(movie.release_date)}</div>
      </div>
    </div>`;
  $('diaryDateInput').value = new Date().toISOString().slice(0,10);
  $('diaryNoteInput').value = '';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeDiaryForm() {
  $('diaryAddPanel').classList.add('hidden');
  _diaryPending = null;
}

function renderDiary() {
  const container = $('diaryEntries');
  const empty = $('diaryEmpty');
  if (!filmDiary.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  const sorted = [...filmDiary].reverse();
  container.innerHTML = sorted.map(entry => `
    <div class="diary-entry" data-id="${entry.id}">
      <div class="diary-entry-poster">
        ${entry.poster ? `<img src="${IMG(entry.poster,'w92')}" alt="">` : '<div class="diary-no-poster">?</div>'}
      </div>
      <div class="diary-entry-body">
        <div class="diary-entry-title">${escHtml(entry.title)}</div>
        <div class="diary-entry-meta">
          <span class="diary-entry-date">${entry.date}</span>
          ${entry.rating ? `<span class="diary-entry-rating">${'★'.repeat(entry.rating)}</span>` : ''}
        </div>
        ${entry.note ? `<div class="diary-entry-note">${escHtml(entry.note)}</div>` : ''}
      </div>
      <button class="diary-entry-remove" data-diary-id="${entry.diaryId}" title="Remove">✕</button>
    </div>`).join('');

  container.querySelectorAll('.diary-entry').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.diary-entry-remove')) return;
      openModal(parseInt(el.dataset.id));
    });
  });
  container.querySelectorAll('.diary-entry-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      filmDiary = filmDiary.filter(d => d.diaryId !== btn.dataset.diaryId);
      saveDiary();
      renderDiary();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = $('diarySaveBtn');
  const cancelBtn = $('diaryCancelBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    if (!_diaryPending) return;
    const entry = {
      diaryId: Date.now().toString(),
      id: _diaryPending.id,
      title: _diaryPending.title || _diaryPending.name,
      poster: _diaryPending.poster_path,
      release_date: _diaryPending.release_date,
      date: $('diaryDateInput').value || new Date().toISOString().slice(0,10),
      note: $('diaryNoteInput').value.trim(),
      rating: personalRatings[_diaryPending.id] || 0,
    };
    filmDiary.push(entry);
    saveDiary();
    renderDiary();
    closeDiaryForm();
    showToast(`Diary entry saved for "${entry.title}"`, 'success');
  });
  if (cancelBtn) cancelBtn.addEventListener('click', closeDiaryForm);
  renderDiary();

  // Radar / Bars view toggle (wired once here)
  document.querySelectorAll('.cs-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cs-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const v = btn.dataset.view;
      const radarWrap = document.getElementById('csRadarWrap');
      const genresEl = document.getElementById('csGenres');
      if (v === 'radar') {
        if (radarWrap) radarWrap.style.display = '';
        if (genresEl) genresEl.style.display = 'none';
        // Redraw radar
        const canvas = document.getElementById('cineRadarCanvas');
        const genres = cineScore.genres || {};
        const entries = Object.entries(genres).sort((a,b) => b[1]-a[1]).slice(0,8);
        if (canvas && entries.length > 1) {
          const labels = entries.map(([gid]) => getGenreName(parseInt(gid)) || 'Other');
          const values = entries.map(([,cnt]) => cnt);
          drawRadarChart(canvas, labels, values, entries[0][1]);
        }
      } else {
        if (radarWrap) radarWrap.style.display = 'none';
        if (genresEl) genresEl.style.display = '';
      }
    });
  });
});

/* =============================================
   DOM REFS
============================================= */
const $  = id => document.getElementById(id);

/* =============================================
   THEME SYSTEM (Dark / Light / Sepia)
============================================= */
let currentTheme = localStorage.getItem('mv_theme') || 'dark';

// Apply data-theme attribute immediately (before DOM refs needed)
document.documentElement.setAttribute('data-theme', currentTheme);

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mv_theme', theme);
  const btn = $('themeToggleBtn');
  if (btn) {
    const icons = { dark: '🌙', light: '☀️', sepia: '🎞️' };
    btn.querySelector('svg') && (btn.querySelector('svg').style.display = 'none');
    let emoji = btn.querySelector('.theme-emoji');
    if (!emoji) { emoji = document.createElement('span'); emoji.className = 'theme-emoji'; btn.insertBefore(emoji, btn.firstChild); }
    emoji.textContent = icons[theme];
  }
}

function cycleTheme() {
  const themes = ['dark', 'light', 'sepia'];
  const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
  // Animated flash transition
  let flash = document.querySelector('.theme-flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.className = 'theme-flash';
    document.body.appendChild(flash);
  }
  flash.classList.add('flash-in');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    applyTheme(next);
    setTimeout(() => flash.classList.remove('flash-in'), 80);
  }));
  showToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'info');
}
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
   HIDDEN GEMS
============================================= */
async function loadHiddenGems() {
  renderSkeletons('hiddenGemsRow', 10);
  try {
    const page = Math.floor(Math.random() * 20) + 1;
    const data = await apiFetch('/discover/movie', {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 200,
      'vote_count.lte': 8000,
      'vote_average.gte': 7.5,
      page,
    });
    const movies = (data.results || []).filter(m => m.poster_path && m.overview);
    displayMovies(movies, 'hiddenGemsRow');
  } catch(e) {
    const el = $('hiddenGemsRow');
    if (el) el.innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">Failed to load.</p>';
  }
}

const hgRefreshBtn = $('hgRefreshBtn');
if (hgRefreshBtn) hgRefreshBtn.addEventListener('click', loadHiddenGems);

/* =============================================
   RUNTIME FILTER
============================================= */
let activeRuntimeMin = 0, activeRuntimeMax = 9999;

document.querySelectorAll('.runtime-pill').forEach(pill => {
  pill.addEventListener('click', async () => {
    document.querySelectorAll('.runtime-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeRuntimeMin = parseInt(pill.dataset.min);
    activeRuntimeMax = parseInt(pill.dataset.max);
    if (activeRuntimeMin === 0 && activeRuntimeMax === 9999) {
      await reloadAllSections();
    } else {
      await filterAllByRuntime(activeRuntimeMin, activeRuntimeMax);
    }
  });
});

async function filterAllByRuntime(minR, maxR) {
  const sections = [
    { id: 'trending',   params: { sort_by: 'popularity.desc', 'vote_count.gte': 200, 'with_runtime.gte': minR, 'with_runtime.lte': maxR } },
    { id: 'topRated',   params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000, 'with_runtime.gte': minR, 'with_runtime.lte': maxR } },
    { id: 'upcoming',   params: { sort_by: 'primary_release_date.desc', 'primary_release_date.gte': new Date().toISOString().slice(0,10), 'with_runtime.gte': minR, 'with_runtime.lte': maxR } },
    { id: 'nowPlaying', params: { sort_by: 'popularity.desc', 'vote_count.gte': 100, 'primary_release_date.lte': new Date().toISOString().slice(0,10), 'with_runtime.gte': minR, 'with_runtime.lte': maxR } },
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
   DAILY ORACLE CHALLENGE
============================================= */
async function openDailyChallenge() {
  const modal = $('dailyChallengeModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const today = new Date().toISOString().slice(0,10);
  const saved = JSON.parse(localStorage.getItem('mv_daily') || '{}');
  const body = $('dailyChallengeBody');

  body.innerHTML = '<div class="oracle-spinning">Consulting the Oracle for today…</div>';

  try {
    // Use today's date as a seed for a consistent daily pick
    const seed = today.replace(/-/g,'');
    const page = (parseInt(seed) % 15) + 1;
    const data = await apiFetch('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 5000, page });
    const movies = (data.results || []).filter(m => m.poster_path && m.overview);
    const idx = parseInt(seed.slice(-2)) % movies.length;
    const movie = movies[idx];

    const alreadyGuessed = saved.date === today;

    body.innerHTML = `
      <div class="daily-challenge-card">
        <img src="${IMG(movie.poster_path, 'w185') || FALLBACK}" alt="${escHtml(movie.title)}">
        <div class="daily-challenge-info">
          <div class="daily-challenge-date">📅 ${today}</div>
          <div class="daily-challenge-title">${escHtml(movie.title)}</div>
          <div class="daily-challenge-meta">${toYear(movie.release_date)} · ★ ${toRating(movie.vote_average)}</div>
          <div class="daily-challenge-overview">${escHtml(movie.overview.slice(0, 120))}…</div>
          ${alreadyGuessed
            ? `<div class="daily-challenge-done">✓ Today's Oracle already visited</div>`
            : `<div class="daily-challenge-cta">Today's Oracle recommends this film for you.</div>`
          }
        </div>
      </div>
      <button class="oracle-open-btn" id="dailyOpenBtn">Open in Oracle →</button>
      <div class="daily-challenge-share" id="dailyShareResult"></div>
    `;

    if (!alreadyGuessed) {
      localStorage.setItem('mv_daily', JSON.stringify({ date: today, movieId: movie.id }));
    }

    $('dailyOpenBtn').addEventListener('click', () => {
      closeDailyChallenge();
      trackCineScore(movie);
      openModal(movie.id);
    });
  } catch(e) {
    body.innerHTML = '<div class="oracle-spinning" style="color:var(--red)">Could not load today\'s challenge.</div>';
  }
}

function closeDailyChallenge() { $('dailyChallengeModal').classList.add('hidden'); document.body.style.overflow = ''; }
$('dailyChallengeClose').addEventListener('click', closeDailyChallenge);
$('dailyChallengeBackdrop').addEventListener('click', closeDailyChallenge);

/* =============================================
   DIRECTOR FILMOGRAPHY PANEL
============================================= */
async function openDirectorFilmography(directorId, directorName) {
  const modal = $('directorModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('directorModalTitle').textContent = `${directorName} — Filmography`;
  const grid = $('directorFilmographyGrid');
  grid.innerHTML = Array.from({ length: 8 }, () => `<div class="skeleton"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`).join('');
  try {
    const credits = await apiFetch(`/person/${directorId}/movie_credits`);
    const directed = (credits.crew || [])
      .filter(m => m.job === 'Director' && m.poster_path)
      .sort((a, b) => b.popularity - a.popularity);
    grid.innerHTML = '';
    directed.forEach(m => {
      const card = createCard(m, id => {
        $('directorModal').classList.add('hidden');
        document.body.style.overflow = '';
        openModal(id);
      });
      card.style.width = '100%';
      grid.appendChild(card);
    });
    if (!directed.length) grid.innerHTML = '<p style="color:var(--text-muted);padding:24px;grid-column:1/-1;font-family:monospace">No directed films found.</p>';
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:24px;grid-column:1/-1;font-family:monospace">Failed to load filmography.</p>';
  }
}

$('closeDirectorModal').addEventListener('click', () => { $('directorModal').classList.add('hidden'); document.body.style.overflow = ''; });
$('directorBackdrop').addEventListener('click', () => { $('directorModal').classList.add('hidden'); document.body.style.overflow = ''; });

/* =============================================
   WATCHLIST EXPORT
============================================= */
function exportWatchlist(format) {
  if (!favorites.length) { showToast('Watchlist is empty', 'info'); return; }
  if (format === 'csv') {
    const header = 'Title,Year,Watched,My Rating\n';
    const rows = favorites.map(m => {
      const isW = watchedList.includes(m.id);
      const r = personalRatings[m.id] || '';
      return `"${(m.title||'').replace(/"/g,'""')}","${toYear(m.release_date)}","${isW ? 'Yes' : 'No'}","${r ? r+'★' : ''}"`;
    }).join('\n');
    downloadFile(header + rows, 'film-oracle-watchlist.csv', 'text/csv');
  } else {
    const lines = favorites.map((m, i) => {
      const isW = watchedList.includes(m.id);
      const r = personalRatings[m.id];
      return `${i+1}. ${m.title} (${toYear(m.release_date)})${isW ? ' ✓' : ''}${r ? ' ' + '★'.repeat(r) : ''}`;
    }).join('\n');
    downloadFile(`THE FILM ORACLE — MY WATCHLIST\nExported ${new Date().toLocaleDateString()}\n${'─'.repeat(40)}\n\n${lines}\n`, 'film-oracle-watchlist.txt', 'text/plain');
  }
}

function downloadFile(content, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  showToast(`Exported as ${filename}`, 'success');
}

const favExportBtn = $('favExportBtn');
if (favExportBtn) {
  favExportBtn.addEventListener('click', () => {
    // Simple toggle dropdown approach
    const existing = document.querySelector('.export-dropdown');
    if (existing) { existing.remove(); return; }
    const drop = document.createElement('div');
    drop.className = 'export-dropdown';
    drop.innerHTML = `
      <button class="export-option" data-fmt="csv">📊 Export CSV</button>
      <button class="export-option" data-fmt="txt">📄 Export TXT</button>
    `;
    favExportBtn.parentElement.style.position = 'relative';
    favExportBtn.parentElement.appendChild(drop);
    drop.querySelectorAll('.export-option').forEach(btn => {
      btn.addEventListener('click', () => { exportWatchlist(btn.dataset.fmt); drop.remove(); });
    });
    setTimeout(() => document.addEventListener('click', function h(e) { if (!drop.contains(e.target)) { drop.remove(); document.removeEventListener('click', h); } }), 10);
  });
}

/* =============================================
   SHORTCUTS MODAL
============================================= */
const shortcutsBtn = $('shortcutsBtn');
const shortcutsModal = $('shortcutsModal');
if (shortcutsBtn) shortcutsBtn.addEventListener('click', () => { shortcutsModal.classList.remove('hidden'); });
if ($('closeShortcuts')) $('closeShortcuts').addEventListener('click', () => shortcutsModal.classList.add('hidden'));
if ($('shortcutsBackdrop')) $('shortcutsBackdrop').addEventListener('click', () => shortcutsModal.classList.add('hidden'));

/* =============================================
   THEME TOGGLE
============================================= */
const themeToggleBtn = $('themeToggleBtn');
if (themeToggleBtn) themeToggleBtn.addEventListener('click', cycleTheme);

// Update theme button icon now that DOM is ready
applyTheme(currentTheme);

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
  ['hidden-gems',       '#hidden-gems'],
  ['diary-section',     '#diary-section'],
  ['mood-matcher',      '#mood-matcher'],
];
let _spyFrame = false;
window.addEventListener('scroll', () => {
  if (_spyFrame) return;
  _spyFrame = true;
  requestAnimationFrame(() => {
    // Use a trigger line 35% down the viewport
    const triggerY = window.scrollY + window.innerHeight * 0.35;
    let bestId = null;
    let bestTop = -Infinity;

    for (const [id] of SPY_MAP) {
      const el = $(id);
      if (!el) continue;
      // getBoundingClientRect().top + scrollY = true document top
      const docTop = el.getBoundingClientRect().top + window.scrollY - 80;
      if (docTop <= triggerY && docTop > bestTop) {
        bestTop = docTop;
        bestId = id;
      }
    }

    // Map section id back to nav href
    const match = SPY_MAP.find(([id]) => id === bestId);
    const best = match ? match[1] : '#hero';

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
    const metaRow = card.querySelector('.card-meta-row');
    if (!metaRow) return;
    let badge = metaRow.querySelector('.card-personal-rating');
    const r = personalRatings[movieId];
    if (r) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'card-personal-rating'; metaRow.appendChild(badge); }
      badge.textContent = '★'.repeat(r);
    } else if (badge) {
      badge.remove();
    }
  });
}



/* =============================================
   NAV SLIDING INDICATOR
============================================= */
function updateNavIndicator(activeLink) {
  const indicator = $('navIndicator');
  const trackEl = document.querySelector('.nav-track');
  if (!indicator || !activeLink || !trackEl) return;

  // Use offsetLeft relative to the track element — this is immune to
  // horizontal scroll position of the nav and viewport scroll position.
  // Walk up from activeLink to find its offset within .nav-track.
  let offsetLeft = 0;
  let el = activeLink;
  while (el && el !== trackEl) {
    offsetLeft += el.offsetLeft;
    el = el.offsetParent;
    if (el === trackEl) break;
  }

  indicator.style.left = activeLink.offsetLeft + 'px';
  indicator.style.width = activeLink.offsetWidth + 'px';
  indicator.style.opacity = '1';
}

// Init indicator once layout is fully settled
window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    const active = document.querySelector('.nav-link.active');
    if (active) updateNavIndicator(active);
  });
});

// Reposition on resize (link widths/positions change)
window.addEventListener('resize', () => {
  const active = document.querySelector('.nav-link.active');
  if (active) updateNavIndicator(active);
}, { passive: true });

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
  const year     = toYear(movie.release_date);

  const genreTags = (movie.genre_ids || []).slice(0, 2)
    .map(id => getGenreName(id)).filter(Boolean)
    .map(n => `<span class="card-genre-tag">${escHtml(n)}</span>`).join('');

  div.innerHTML = `
    <div class="card-poster">
      <img src="${poster}" alt="${escHtml(movie.title || movie.name)}" loading="lazy" onerror="this.src='${FALLBACK}'">
      ${makeRatingRing(rating)}
      <div class="card-actions">
        <button class="card-rate-btn" title="Rate this film">★</button>
        <button class="card-compare-btn" title="Add to Compare">⊕</button>
      </div>
      <div class="card-overlay">
        <div class="card-play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        ${year !== '—' ? `<div class="card-year-overlay">${year}</div>` : ''}
        ${genreTags ? `<div class="card-genre-row">${genreTags}</div>` : ''}
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${escHtml(movie.title || movie.name || 'Untitled')}</div>
      <div class="card-meta-row">
        ${year !== '—' ? `<span class="card-year">${year}</span>` : ''}
        ${myRating ? `<span class="card-personal-rating">${'★'.repeat(myRating)}</span>` : ''}
      </div>
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
  // Attach bulge effect to this row
  initRowBulge(el);
}

/* =============================================
   ROW INIT (bulge effect removed)
============================================= */
const _bulgeRows = new WeakSet();

function initRowBulge(rowEl) {
  return; // bulge disabled
  if (!rowEl || _bulgeRows.has(rowEl)) return;
  _bulgeRows.add(rowEl);

  let rafId = null;

  function applyBulge() {
    const rowRect = rowEl.getBoundingClientRect();
    const rowCx = rowRect.left + rowRect.width / 2; // viewport centre of row
    const cards = rowEl.querySelectorAll('.card');

    cards.forEach(card => {
      const cardRect = card.getBoundingClientRect();
      const cardCx = cardRect.left + cardRect.width / 2;

      // Distance from centre, normalised to [-1, 1] over visible row width
      const dist = (cardCx - rowCx) / (rowRect.width * 0.5);
      const absDist = Math.abs(dist);

      // Scale: 1.0 at centre → 0.82 at edges  (cosine falloff)
      const scale = 0.82 + 0.18 * Math.cos(absDist * Math.PI * 0.72);

      // Slight Y lift at centre
      const translateY = absDist < 0.15 ? -8 : 0;

      // Opacity: fully opaque centre, dim edges
      const opacity = 0.45 + 0.55 * Math.max(0, 1 - absDist * 0.9);

      // Rotational tilt (Y axis) — subtle depth cue
      const rotateY = dist * 14; // degrees, max ±14°

      card.style.transform = `scale(${scale.toFixed(3)}) translateY(${translateY}px) rotateY(${rotateY.toFixed(1)}deg)`;
      card.style.opacity = opacity.toFixed(3);

      // Mark centre card for CSS glow
      card.classList.toggle('bulge-center', absDist < 0.15);
    });

    rafId = null;
  }

  // Throttle to rAF
  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(applyBulge);
  }

  rowEl.addEventListener('scroll', onScroll, { passive: true });

  // Also rerun on window scroll (row might move into view)
  window.addEventListener('scroll', onScroll, { passive: true });

  // Run once immediately so it's correct on load
  requestAnimationFrame(applyBulge);
}

// Re-apply bulge on resize
window.addEventListener('resize', () => {
  document.querySelectorAll('.row').forEach(row => {
    const cards = row.querySelectorAll('.card');
    if (cards.length) {
      // Trigger a recalc
      row.dispatchEvent(new Event('scroll'));
    }
  });
}, { passive: true });

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
      <div class="fav-item ${isW ? 'watched-item' : ''}" data-id="${m.id}" draggable="true">
        <div class="fav-drag-handle" title="Drag to reorder">⠿</div>
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

  // Drag-to-reorder
  let dragSrc = null;
  favList.querySelectorAll('.fav-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      favList.querySelectorAll('.fav-item').forEach(i => i.classList.remove('drag-over'));
      dragSrc = null;
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item !== dragSrc) {
        favList.querySelectorAll('.fav-item').forEach(i => i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      const srcId = parseInt(dragSrc.dataset.id);
      const dstId = parseInt(item.dataset.id);
      // Reorder favorites array
      const srcIdx = favorites.findIndex(f => f.id === srcId);
      const dstIdx = favorites.findIndex(f => f.id === dstId);
      if (srcIdx > -1 && dstIdx > -1) {
        const [moved] = favorites.splice(srcIdx, 1);
        favorites.splice(dstIdx, 0, moved);
        saveFavorites();
        renderFavPanel();
      }
    });
  });

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

/* =============================================
   RADAR CHART (Canvas, no library)
============================================= */
function drawRadarChart(canvas, labels, values, maxVal) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const radius = Math.min(cx, cy) - 32;
  const N = labels.length;
  if (!N) { ctx.clearRect(0,0,W,H); return; }

  ctx.clearRect(0, 0, W, H);

  const angle = i => (Math.PI * 2 * i / N) - Math.PI / 2;
  const pt = (i, r) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i))
  });

  // Determine colors from current theme
  const isDark = document.documentElement.dataset.theme !== 'light' && document.documentElement.dataset.theme !== 'sepia';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const axisColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
  const labelColor = isDark ? 'rgba(240,234,214,0.7)' : 'rgba(40,40,60,0.75)';
  const fillColor = 'rgba(0,229,204,0.18)';
  const strokeColor = 'rgba(0,229,204,0.85)';
  const dotColor = '#00e5cc';

  // Draw web grid lines (3 rings)
  for (let ring = 1; ring <= 3; ring++) {
    const r = radius * (ring / 3);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p = pt(i, r);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw axes
  for (let i = 0; i < N; i++) {
    const p = pt(i, radius);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw data polygon
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const r = radius * Math.min((values[i] / maxVal), 1);
    const p = pt(i, r);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dots
  for (let i = 0; i < N; i++) {
    const r = radius * Math.min((values[i] / maxVal), 1);
    const p = pt(i, r);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
  }

  // Labels
  ctx.font = `700 9px 'DM Mono', monospace`;
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const lp = pt(i, radius + 22);
    // Clamp within canvas
    const lx = Math.max(10, Math.min(W - 10, lp.x));
    const ly = Math.max(10, Math.min(H - 10, lp.y));
    ctx.fillText(labels[i].toUpperCase(), lx, ly);
  }
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

  // Radar chart
  const canvas = $('cineRadarCanvas');
  if (canvas && genreEntries.length > 1) {
    const labels = genreEntries.map(([gid]) => getGenreName(parseInt(gid)) || 'Other');
    const values = genreEntries.map(([, cnt]) => cnt);
    drawRadarChart(canvas, labels, values, maxVal);
  } else if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(122,122,140,0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Open films to build your radar', canvas.width/2, canvas.height/2);
  }

  // Bars (hidden by default)
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

  // NOTE: view toggle is wired once in DOMContentLoaded (not here, to avoid stacking)
}

function openCineScore() {
  cineScorePanel.classList.remove('hidden');
  cineScoreOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Draw radar after panel is visible so canvas has real dimensions
  requestAnimationFrame(() => renderCineScore());
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
    if ($('shortcutsModal') && !$('shortcutsModal').classList.contains('hidden')) { $('shortcutsModal').classList.add('hidden'); return; }
    if ($('dailyChallengeModal') && !$('dailyChallengeModal').classList.contains('hidden')) { closeDailyChallenge(); return; }
    if ($('directorModal') && !$('directorModal').classList.contains('hidden')) { $('directorModal').classList.add('hidden'); document.body.style.overflow = ''; return; }
  }
  const tag = document.activeElement.tagName;
  if (['INPUT','TEXTAREA'].includes(tag)) return;
  if (e.key === '/') { e.preventDefault(); openSearchModal(); }
  if (e.key === '?') { e.preventDefault(); $('shortcutsModal')?.classList.remove('hidden'); }
  if (e.key === 'o' || e.key === 'O') { e.preventDefault(); oracleModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  if (e.key === 'c' || e.key === 'C') { e.preventDefault(); compareToggleBtn.click(); }
  if (e.key === 'w' || e.key === 'W') { e.preventDefault(); openFavPanel(); }
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); openCineScore(); }
  if (e.key === 't' || e.key === 'T') { e.preventDefault(); cycleTheme(); }
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
  // Reset badge while loading
  const badge = document.getElementById('worldCountryBadge');
  if (badge) badge.style.display = 'none';
  renderSkeletons('worldCinemaRow', 10);
  try {
    const data = await apiFetch('/discover/movie', {
      with_original_language: lang,
      sort_by: 'popularity.desc',
      'vote_count.gte': lang === 'en' ? 500 : 100,
      page: 1
    });
    displayMovies(data.results, 'worldCinemaRow');
    // Enrich with REST Countries flag/language info
    enrichWorldCinemaWithCountry(lang);
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
loadNowPlayingLocale(); // Locale-aware now playing
initWorldCinema();
initDecadeMachine();
loadGuesserRound();
loadHiddenGems();

// Daily Oracle badge — show a "Today" indicator if not yet seen
const dailySaved = JSON.parse(localStorage.getItem('mv_daily') || '{}');
const todayStr = new Date().toISOString().slice(0,10);
if (dailySaved.date !== todayStr) {
  // Add daily oracle trigger button to the footer brand
  const footerBrand = document.querySelector('.footer-brand');
  if (footerBrand) {
    const dailyBtn = document.createElement('button');
    dailyBtn.className = 'daily-oracle-footer-btn';
    dailyBtn.innerHTML = '📅 Today\'s Daily Oracle';
    dailyBtn.addEventListener('click', openDailyChallenge);
    footerBrand.appendChild(dailyBtn);
  }
}
/* =====================================================
   FEATURE 1 — WHERE TO WATCH (Streaming Providers)
===================================================== */
async function openWatchProviders(movieId, movieTitle) {
  const modal = $('watchProvidersModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('watchProvidersTitle').textContent = `Where to Watch — ${movieTitle}`;
  const body = $('watchProvidersBody');
  body.innerHTML = '<div class="wp-loading"><div class="search-spinner"></div>Finding streaming options…</div>';
  try {
    const data = await apiFetch(`/movie/${movieId}/watch/providers`);
    const us = (data.results || {}).US || (data.results || {})[Object.keys(data.results || {})[0]] || null;
    if (!us) {
      body.innerHTML = '<div class="wp-none">No streaming data available for this region.</div>';
      return;
    }
    const renderRow = (title, items, cls) => {
      if (!items || !items.length) return '';
      return `<div class="wp-row">
        <div class="wp-row-label">${title}</div>
        <div class="wp-logos">
          ${items.map(p => `
            <div class="wp-provider" title="${escHtml(p.provider_name)}">
              <img src="https://image.tmdb.org/t/p/w45${p.logo_path}" alt="${escHtml(p.provider_name)}" class="wp-logo ${cls}">
              <span class="wp-name">${escHtml(p.provider_name)}</span>
            </div>`).join('')}
        </div>
      </div>`;
    };
    const hasAny = us.flatrate || us.rent || us.buy || us.ads;
    if (!hasAny) {
      body.innerHTML = '<div class="wp-none">Not currently available on any tracked streaming platforms.</div>';
      return;
    }
    body.innerHTML = `
      <div class="wp-content">
        ${renderRow('Stream', us.flatrate, 'wp-stream')}
        ${renderRow('Free (Ads)', us.ads, 'wp-ads')}
        ${renderRow('Rent', us.rent, 'wp-rent')}
        ${renderRow('Buy', us.buy, 'wp-buy')}
        <div class="wp-source">Data provided by <a href="${us.link || '#'}" target="_blank" rel="noopener">JustWatch</a></div>
      </div>`;
  } catch(e) {
    body.innerHTML = '<div class="wp-none">Could not load provider data.</div>';
  }
}
$('closeWatchProviders').addEventListener('click', () => { $('watchProvidersModal').classList.add('hidden'); document.body.style.overflow = ''; });
$('watchProvidersBackdrop').addEventListener('click', () => { $('watchProvidersModal').classList.add('hidden'); document.body.style.overflow = ''; });

/* =====================================================
   FEATURE 2 — ADVANCED FILTERS IN SEE ALL
===================================================== */
// Patch openSearchResultsModal and seeAll to include filter bar
let seeAllCurrentEndpoint = null;
let seeAllFilters = { genre: '', year: '', minRating: '', sort: 'popularity.desc' };

function buildSeeAllFilterBar() {
  const existing = $('seeAllFilterBar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'seeAllFilterBar';
  bar.className = 'see-all-filter-bar';
  bar.innerHTML = `
    <div class="sa-filter-group">
      <label>Genre</label>
      <select id="saGenreFilter" class="sa-filter-select">
        <option value="">All Genres</option>
        ${Object.entries(GENRE_MAP).map(([id,name]) => `<option value="${id}">${name}</option>`).join('')}
      </select>
    </div>
    <div class="sa-filter-group">
      <label>Min Year</label>
      <select id="saYearFilter" class="sa-filter-select">
        <option value="">Any Year</option>
        ${Array.from({length:13},(_,i)=>2024-i*5).map(y=>`<option value="${y}">${y}s</option>`).join('')}
      </select>
    </div>
    <div class="sa-filter-group">
      <label>Min Rating</label>
      <select id="saRatingFilter" class="sa-filter-select">
        <option value="">Any Rating</option>
        <option value="9">9+</option>
        <option value="8">8+</option>
        <option value="7">7+</option>
        <option value="6">6+</option>
      </select>
    </div>
    <div class="sa-filter-group">
      <label>Sort By</label>
      <select id="saSortFilter" class="sa-filter-select">
        <option value="popularity.desc">Popularity</option>
        <option value="vote_average.desc">Rating</option>
        <option value="primary_release_date.desc">Newest</option>
        <option value="primary_release_date.asc">Oldest</option>
        <option value="revenue.desc">Box Office</option>
      </select>
    </div>
    <button class="sa-apply-btn" id="saApplyBtn">Apply</button>
    <button class="sa-reset-btn" id="saResetBtn">Reset</button>
  `;
  const header = seeAllModal.querySelector('.see-all-header');
  header.insertAdjacentElement('afterend', bar);
  
  $('saApplyBtn').addEventListener('click', applySeeAllFilters);
  $('saResetBtn').addEventListener('click', () => {
    $('saGenreFilter').value = '';
    $('saYearFilter').value = '';
    $('saRatingFilter').value = '';
    $('saSortFilter').value = 'popularity.desc';
    applySeeAllFilters();
  });
}

async function applySeeAllFilters() {
  if (!seeAllCurrentEndpoint) return;
  const genre = $('saGenreFilter')?.value || '';
  const year = $('saYearFilter')?.value || '';
  const rating = $('saRatingFilter')?.value || '';
  const sort = $('saSortFilter')?.value || 'popularity.desc';
  
  seeAllGrid.innerHTML = Array.from({length:20},()=>`<div class="skeleton"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`).join('');
  
  const params = { page: 1, sort_by: sort };
  if (genre) params.with_genres = genre;
  if (year) params['primary_release_date.gte'] = `${year}-01-01`;
  if (rating) { params['vote_average.gte'] = rating; params['vote_count.gte'] = 200; }
  
  try {
    const [p1, p2] = await Promise.all([
      apiFetch('/discover/movie', {...params, page:1}),
      apiFetch('/discover/movie', {...params, page:2})
    ]);
    const movies = [...(p1.results||[]), ...(p2.results||[])].filter(m=>m.poster_path);
    seeAllGrid.innerHTML = '';
    if (!movies.length) { seeAllGrid.innerHTML = '<p style="color:var(--text-muted);padding:22px;grid-column:1/-1;font-family:monospace;font-size:12px">No films match these filters.</p>'; return; }
    movies.forEach(m => { const c = createCard(m, id => { closeSeeAllFn(); openModal(id); }); c.style.width='100%'; seeAllGrid.appendChild(c); });
    // Infinite scroll
    setupSeeAllInfiniteScroll(params, 3);
  } catch(e) {
    seeAllGrid.innerHTML = '<p style="color:var(--text-muted);padding:22px;grid-column:1/-1;font-family:monospace;font-size:12px">Failed to load.</p>';
  }
}

/* =====================================================
   FEATURE 3 — INFINITE SCROLL IN SEE ALL
===================================================== */
let _seeAllPage = 2;
let _seeAllLoading = false;
let _seeAllHasMore = true;
let _seeAllScrollParams = null;

function setupSeeAllInfiniteScroll(params, startPage = 3) {
  _seeAllPage = startPage;
  _seeAllLoading = false;
  _seeAllHasMore = true;
  _seeAllScrollParams = {...params};
  const sheet = seeAllModal.querySelector('.modal-sheet');
  sheet.onscroll = null;
  sheet.addEventListener('scroll', onSeeAllScroll, { passive: true });
}

async function onSeeAllScroll(e) {
  const el = e.target;
  if (_seeAllLoading || !_seeAllHasMore) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
    _seeAllLoading = true;
    const loader = document.createElement('div');
    loader.className = 'see-all-loader';
    loader.innerHTML = '<div class="search-spinner"></div>';
    seeAllGrid.appendChild(loader);
    try {
      const data = await apiFetch('/discover/movie', {..._seeAllScrollParams, page: _seeAllPage});
      loader.remove();
      const movies = (data.results||[]).filter(m=>m.poster_path);
      if (!movies.length || _seeAllPage >= (data.total_pages||1)) _seeAllHasMore = false;
      movies.forEach(m => { const c = createCard(m, id => { closeSeeAllFn(); openModal(id); }); c.style.width='100%'; seeAllGrid.appendChild(c); });
      _seeAllPage++;
    } catch(e) { loader.remove(); }
    _seeAllLoading = false;
  }
}

// Patch existing see-all button handler to set current endpoint + filter bar
const _origSeeAllBtns = document.querySelectorAll('.see-all-btn');
_origSeeAllBtns.forEach(btn => {
  // Re-attach with enhanced logic
  btn.addEventListener('click', async function enhancedSeeAll() {
    seeAllCurrentEndpoint = btn.dataset.endpoint;
    seeAllTitle.textContent = btn.dataset.label;
    seeAllGrid.innerHTML = '';
    seeAllModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    buildSeeAllFilterBar();
    const skels = Array.from({length:20},()=>`<div class="skeleton"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`).join('');
    seeAllGrid.innerHTML = skels;
    try {
      const [p1, p2] = await Promise.all([apiFetch(seeAllCurrentEndpoint,{page:1}), apiFetch(seeAllCurrentEndpoint,{page:2})]);
      const movies = [...(p1.results||[]), ...(p2.results||[])].filter(m=>m.poster_path);
      seeAllGrid.innerHTML = '';
      movies.forEach(m => { const c = createCard(m, id=>{ closeSeeAllFn(); openModal(id); }); c.style.width='100%'; seeAllGrid.appendChild(c); });
      setupSeeAllInfiniteScroll({ sort_by: 'popularity.desc' }, 3);
    } catch(e) {
      seeAllGrid.innerHTML = '<p style="color:var(--text-muted);padding:22px;grid-column:1/-1;font-family:monospace;font-size:12px">Failed to load.</p>';
    }
  }, false);
});

/* =====================================================
   FEATURE 4 — RECENTLY VIEWED ROW
===================================================== */
const MAX_RECENT = 20;
let recentlyViewed = JSON.parse(localStorage.getItem('mv_recent') || '[]');

function addToRecentlyViewed(movie) {
  recentlyViewed = recentlyViewed.filter(m => m.id !== movie.id);
  recentlyViewed.unshift({ id: movie.id, title: movie.title || movie.name, poster_path: movie.poster_path, release_date: movie.release_date, vote_average: movie.vote_average, genre_ids: movie.genre_ids || [] });
  if (recentlyViewed.length > MAX_RECENT) recentlyViewed = recentlyViewed.slice(0, MAX_RECENT);
  localStorage.setItem('mv_recent', JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const row = $('recentlyViewedRow');
  const empty = $('rvEmpty');
  const section = $('recently-viewed');
  if (!row) return;
  if (!recentlyViewed.length) {
    row.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    if (section) section.classList.add('rv-empty-section');
    return;
  }
  if (empty) empty.classList.add('hidden');
  if (section) section.classList.remove('rv-empty-section');
  row.innerHTML = '';
  recentlyViewed.forEach(m => row.appendChild(createCard(m, openModal)));
}

const rvClearBtn = $('rvClearBtn');
if (rvClearBtn) rvClearBtn.addEventListener('click', () => {
  recentlyViewed = [];
  localStorage.removeItem('mv_recent');
  renderRecentlyViewed();
  showToast('Viewing history cleared', 'info');
});

// openModal is defined below and already handles recently viewed tracking internally

/* =====================================================
   FEATURE 5 — SHARE CARD GENERATOR
===================================================== */
let _shareMovie = null;

async function openShareCard(movie) {
  _shareMovie = movie;
  const modal = $('shareCardModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  await generateShareCanvas(movie);
}

async function generateShareCanvas(movie) {
  const canvas = $('shareCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 400; canvas.height = 560;
  
  // Background
  ctx.fillStyle = '#0c0c0f';
  ctx.fillRect(0, 0, 400, 560);
  
  // Gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 400, 0);
  grad.addColorStop(0, 'rgba(0,229,204,0.12)');
  grad.addColorStop(1, 'rgba(201,168,76,0.08)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 560);
  
  // Border
  ctx.strokeStyle = 'rgba(0,229,204,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, 398, 558);
  
  // Load poster
  try {
    const img = await loadImage(IMG(movie.poster_path, 'w342') || FALLBACK);
    const posterH = 380;
    const posterW = Math.min(400, img.width * (posterH / img.height));
    const posterX = (400 - posterW) / 2;
    ctx.drawImage(img, posterX, 0, posterW, posterH);
    
    // Poster gradient overlay
    const g2 = ctx.createLinearGradient(0, 260, 0, 380);
    g2.addColorStop(0, 'rgba(12,12,15,0)');
    g2.addColorStop(1, 'rgba(12,12,15,1)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 260, 400, 120);
  } catch(e) {}
  
  // Title
  ctx.fillStyle = '#f0ead6';
  ctx.font = 'bold 22px "Arial", sans-serif';
  ctx.textAlign = 'center';
  const title = (movie.title || movie.name || '').toUpperCase();
  wrapText(ctx, title, 200, 400, 360, 28);
  
  // Meta
  ctx.font = '12px monospace';
  ctx.fillStyle = '#c9a84c';
  const year = toYear(movie.release_date);
  const rating = movie.vote_average ? `★ ${movie.vote_average.toFixed(1)}` : '';
  ctx.fillText(`${year}  ${rating}`, 200, 440);
  
  // My rating
  const myR = personalRatings[movie.id];
  if (myR) {
    ctx.fillStyle = '#c9a84c';
    ctx.font = '16px monospace';
    ctx.fillText('★'.repeat(myR), 200, 466);
  }
  
  // Genres
  const genres = (movie.genre_ids || []).slice(0,3).map(id => getGenreName(id)).filter(Boolean).join('  ·  ');
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(240,234,214,0.4)';
  ctx.fillText(genres.toUpperCase(), 200, 490);
  
  // Branding
  ctx.fillStyle = 'rgba(0,229,204,0.7)';
  ctx.font = '10px monospace';
  ctx.fillText('◉ THE FILM ORACLE', 200, 540);
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

$('shareDownloadBtn').addEventListener('click', () => {
  const canvas = $('shareCanvas');
  const link = document.createElement('a');
  link.download = `film-oracle-${(_shareMovie?.title || 'share').replace(/[^a-z0-9]/gi,'_').toLowerCase()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Image downloaded!', 'success');
});

$('shareCopyBtn').addEventListener('click', async () => {
  const canvas = $('shareCanvas');
  try {
    canvas.toBlob(async blob => {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Copied to clipboard!', 'success');
    });
  } catch(e) {
    showToast('Copy not supported in this browser', 'info');
  }
});

$('closeShareCard').addEventListener('click', () => { $('shareCardModal').classList.add('hidden'); document.body.style.overflow = ''; });
$('shareCardBackdrop').addEventListener('click', () => { $('shareCardModal').classList.add('hidden'); document.body.style.overflow = ''; });

/* =====================================================
   FEATURE 6 — TRAILER GALLERY
===================================================== */
async function openTrailerGallery(movieId, movieTitle) {
  const modal = $('trailerGalleryModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('trailerGalleryTitle').textContent = `Videos — ${movieTitle}`;
  const body = $('trailerGalleryBody');
  body.innerHTML = '<div class="tg-loading"><div class="search-spinner"></div>Loading videos…</div>';
  try {
    const data = await apiFetch(`/movie/${movieId}/videos`);
    const videos = (data.results || []).filter(v => v.site === 'YouTube');
    if (!videos.length) {
      body.innerHTML = '<div class="tg-none">No videos available for this film.</div>';
      return;
    }
    // Group by type
    const groups = {};
    videos.forEach(v => { groups[v.type] = groups[v.type] || []; groups[v.type].push(v); });
    let html = '';
    const order = ['Trailer', 'Teaser', 'Clip', 'Featurette', 'Behind the Scenes', 'Bloopers'];
    order.forEach(type => {
      if (!groups[type]) return;
      html += `<div class="tg-group"><div class="tg-group-label">${type}s</div><div class="tg-grid">`;
      groups[type].forEach(v => {
        html += `
          <div class="tg-item" data-key="${escHtml(v.key)}">
            <div class="tg-thumb">
              <img src="https://img.youtube.com/vi/${escHtml(v.key)}/mqdefault.jpg" alt="${escHtml(v.name)}" loading="lazy">
              <div class="tg-play"><svg viewBox="0 0 24 24" fill="#080810"><path d="M8 5v14l11-7z"/></svg></div>
            </div>
            <div class="tg-name">${escHtml(v.name)}</div>
          </div>`;
      });
      html += '</div></div>';
    });
    body.innerHTML = html;
    
    let activePlayer = null;
    body.querySelectorAll('.tg-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.key;
        if (activePlayer) activePlayer.remove();
        const player = document.createElement('div');
        player.className = 'tg-player';
        player.innerHTML = `<iframe src="https://www.youtube.com/embed/${key}?autoplay=1&rel=0" allowfullscreen allow="autoplay;encrypted-media"></iframe>`;
        item.insertAdjacentElement('afterend', player);
        activePlayer = player;
        player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  } catch(e) {
    body.innerHTML = '<div class="tg-none">Could not load videos.</div>';
  }
}

$('closeTrailerGallery').addEventListener('click', () => {
  $('trailerGalleryModal').classList.add('hidden');
  document.body.style.overflow = '';
  // Stop any playing video
  const iframe = $('trailerGalleryBody').querySelector('iframe');
  if (iframe) { const s = iframe.src; iframe.src = ''; iframe.src = s; }
});
$('trailerGalleryBackdrop').addEventListener('click', () => {
  $('trailerGalleryModal').classList.add('hidden');
  document.body.style.overflow = '';
});

/* =====================================================
   FEATURE 7 — COLLECTION / FRANCHISE VIEW
===================================================== */
async function openCollection(collectionId, collectionName) {
  const modal = $('collectionModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('collectionTitle').textContent = `📽 ${collectionName}`;
  const grid = $('collectionGrid');
  grid.innerHTML = Array.from({length:6},()=>`<div class="skeleton"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`).join('');
  try {
    const data = await apiFetch(`/collection/${collectionId}`);
    const parts = (data.parts || []).sort((a,b) => (a.release_date||'').localeCompare(b.release_date||''));
    grid.innerHTML = '';
    parts.forEach((m, i) => {
      const card = createCard(m, id => { closeCollection(); openModal(id); });
      card.style.width = '100%';
      // Add part number badge
      const badge = document.createElement('div');
      badge.className = 'collection-part-badge';
      badge.textContent = `#${i + 1}`;
      card.querySelector('.card-poster').appendChild(badge);
      grid.appendChild(card);
    });
    if (!parts.length) grid.innerHTML = '<p style="color:var(--text-muted);padding:24px;grid-column:1/-1;font-family:monospace">No films in collection.</p>';
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:24px;grid-column:1/-1;font-family:monospace">Failed to load collection.</p>';
  }
}

function closeCollection() { $('collectionModal').classList.add('hidden'); document.body.style.overflow = ''; }
$('closeCollection').addEventListener('click', closeCollection);
$('collectionBackdrop').addEventListener('click', closeCollection);

/* =====================================================
   FEATURE 8 — BECAUSE YOU WATCHED
===================================================== */
async function loadBecauseYouWatched() {
  const section = $('because-section');
  if (!section) return;
  
  // Need at least 3 watched films to show recommendations
  const watched = watchedList.filter(id => favorites.some(f => f.id === id));
  const pool = watched.length >= 1 ? watched : watchedList;
  
  if (!pool.length) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = '';
  // Pick highest rated watched film as seed
  const ratedWatched = pool.map(id => ({ id, rating: personalRatings[id] || 0 })).sort((a,b) => b.rating - a.rating);
  const seedId = ratedWatched[0]?.id || pool[0];
  const seedFav = favorites.find(f => f.id === seedId);
  const seedTitle = seedFav?.title || 'a film you watched';
  
  const basedOn = $('becauseBasedOn');
  if (basedOn) basedOn.textContent = `Based on: ${seedTitle}`;
  
  renderSkeletons('becauseRow', 10);
  try {
    const data = await apiFetch(`/movie/${seedId}/recommendations`);
    const movies = (data.results || []).filter(m => m.poster_path && !watchedList.includes(m.id));
    if (!movies.length) { section.style.display = 'none'; return; }
    displayMovies(movies, 'becauseRow');
  } catch(e) {
    section.style.display = 'none';
  }
}

/* =====================================================
   FEATURE 9 — FILM STATISTICS DASHBOARD
===================================================== */
async function renderStatsDashboard() {
  const grid = $('statsGrid');
  const genreBars = $('statsGenreBars');
  const ratingDist = $('statsRatingDist');
  const timeline = $('statsTimeline');
  if (!grid) return;
  
  const totalWatched = watchedList.length;
  const totalWatchlist = favorites.length;
  const totalRated = Object.keys(personalRatings).length;
  const diaryEntries = filmDiary.length;
  const avgRating = totalRated > 0 ? (Object.values(personalRatings).reduce((a,b)=>a+b,0)/totalRated).toFixed(1) : '—';
  
  // Estimate total runtime from diary (avg 110 min)
  const estHours = Math.round(totalWatched * 110 / 60);
  
  grid.innerHTML = `
    <div class="stat-tile">
      <div class="stat-tile-val">${totalWatched}</div>
      <div class="stat-tile-label">Films Watched</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile-val">${totalWatchlist}</div>
      <div class="stat-tile-label">In Watchlist</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile-val">${avgRating}</div>
      <div class="stat-tile-label">Avg Rating</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile-val">${totalRated}</div>
      <div class="stat-tile-label">Films Rated</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile-val">~${estHours}h</div>
      <div class="stat-tile-label">Est. Watch Time</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile-val">${diaryEntries}</div>
      <div class="stat-tile-label">Diary Entries</div>
    </div>
  `;
  
  // Genre breakdown from CineScore
  const genres = cineScore.genres || {};
  const genreEntries = Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxG = genreEntries[0]?.[1] || 1;
  if (genreBars) {
    genreBars.innerHTML = genreEntries.length ? genreEntries.map(([gid, cnt]) => `
      <div class="sbar-row">
        <div class="sbar-label">${getGenreName(parseInt(gid)) || 'Other'}</div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.round(cnt/maxG*100)}%"></div></div>
        <div class="sbar-val">${cnt}</div>
      </div>`).join('')
    : '<div class="stats-empty">Open films to build your genre profile</div>';
  }
  
  // Rating distribution
  const ratingCounts = [0,0,0,0,0];
  Object.values(personalRatings).forEach(r => { if (r>=1&&r<=5) ratingCounts[r-1]++; });
  const maxRC = Math.max(...ratingCounts, 1);
  if (ratingDist) {
    ratingDist.innerHTML = ratingCounts.map((cnt, i) => `
      <div class="rdist-col">
        <div class="rdist-bar-wrap"><div class="rdist-bar" style="height:${Math.round(cnt/maxRC*80)}px"></div></div>
        <div class="rdist-label">${'★'.repeat(i+1)}</div>
        <div class="rdist-count">${cnt}</div>
      </div>`).join('');
  }
  
  // Diary timeline — group by month
  const monthMap = {};
  filmDiary.forEach(e => {
    const month = e.date ? e.date.slice(0,7) : 'unknown';
    monthMap[month] = (monthMap[month] || 0) + 1;
  });
  const months = Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const maxM = Math.max(...months.map(m=>m[1]), 1);
  if (timeline) {
    timeline.innerHTML = months.length ? `<div class="tl-bars">${months.map(([mo,cnt]) => `
      <div class="tl-col">
        <div class="tl-bar-wrap"><div class="tl-bar" style="height:${Math.round(cnt/maxM*80)}px"></div></div>
        <div class="tl-label">${mo.slice(5)}</div>
        <div class="tl-count">${cnt}</div>
      </div>`).join('')}</div>`
    : '<div class="stats-empty">Log films in your Diary to see your timeline</div>';
  }
  
  // Load blind spots
  await loadBlindSpots();
}

/* =====================================================
   FEATURE 10 — BLIND SPOT GENERATOR
===================================================== */
async function loadBlindSpots() {
  const row = $('blindSpotRow');
  if (!row) return;
  renderSkeletons('blindSpotRow', 8);
  try {
    const [p1, p2] = await Promise.all([
      apiFetch('/movie/top_rated', { page: 1 }),
      apiFetch('/movie/top_rated', { page: 2 })
    ]);
    const topRated = [...(p1.results||[]), ...(p2.results||[])].filter(m => m.poster_path);
    const blindSpots = topRated.filter(m => !watchedList.includes(m.id) && m.vote_average >= 8.0);
    row.innerHTML = '';
    blindSpots.slice(0, 15).forEach(m => row.appendChild(createCard(m, openModal)));
    if (!blindSpots.length) row.innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">No blind spots found — you\'ve seen them all! 🎉</p>';
  } catch(e) { row.innerHTML = ''; }
}

/* =====================================================
   FEATURE 11 — DIRECTOR DUEL
===================================================== */
let duelDirectors = [null, null];
let duelTimers = [null, null];

function openDirectorDuel() {
  $('directorDuelModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  duelDirectors = [null, null];
  $('duelGrid').innerHTML = '';
  $('duelFightBtn').disabled = true;
}

['A','B'].forEach((letter, idx) => {
  const input = $(`duelInput${letter}`);
  const results = $(`duelResults${letter}`);
  const chosen = $(`duelChosen${letter}`);
  if (!input) return;
  
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(duelTimers[idx]);
    if (q.length < 2) { results.classList.add('hidden'); return; }
    duelTimers[idx] = setTimeout(() => doDuelSearch(q, letter, idx, results, chosen), 300);
  });
});

async function doDuelSearch(q, letter, idx, results, chosen) {
  results.classList.remove('hidden');
  results.innerHTML = '<div class="dir-duel-loading"><div class="search-spinner" style="width:12px;height:12px;border-width:1.5px"></div>Searching…</div>';
  try {
    const data = await apiFetch('/search/person', { query: q });
    const directors = (data.results||[]).filter(p => p.known_for_department === 'Directing' || (p.known_for||[]).some(k => k.media_type === 'movie')).slice(0,5);
    if (!directors.length) { results.innerHTML = '<div class="dir-duel-loading">No directors found</div>'; return; }
    results.innerHTML = directors.map(p => `
      <div class="dir-duel-result" data-id="${p.id}" data-name="${escHtml(p.name)}" data-photo="${p.profile_path || ''}">
        ${p.profile_path ? `<img src="${IMG(p.profile_path,'w45')}" alt="">` : '<div class="dir-duel-avatar-ph">?</div>'}
        <span>${escHtml(p.name)}</span>
      </div>`).join('');
    results.querySelectorAll('.dir-duel-result').forEach(el => {
      el.addEventListener('click', () => {
        duelDirectors[idx] = { id: parseInt(el.dataset.id), name: el.dataset.name, photo: el.dataset.photo };
        results.classList.add('hidden');
        const input = $(`duelInput${letter}`);
        if (input) input.value = el.dataset.name;
        const chosenEl = $(`duelChosen${letter}`);
        if (chosenEl) {
          chosenEl.classList.remove('hidden');
          chosenEl.innerHTML = el.dataset.photo ? `<img src="${IMG(el.dataset.photo,'w45')}" alt="">` : '';
          chosenEl.innerHTML += `<span>${escHtml(el.dataset.name)}</span>`;
        }
        $('duelFightBtn').disabled = !(duelDirectors[0] && duelDirectors[1]);
      });
    });
  } catch(e) { results.innerHTML = '<div class="dir-duel-loading">Search failed</div>'; }
}

$('duelFightBtn').addEventListener('click', async () => {
  if (!duelDirectors[0] || !duelDirectors[1]) return;
  const grid = $('duelGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;font-family:monospace;font-size:11px;color:var(--text-muted)">Loading filmographies…</div>';
  try {
    const [c1, c2] = await Promise.all([
      apiFetch(`/person/${duelDirectors[0].id}/movie_credits`),
      apiFetch(`/person/${duelDirectors[1].id}/movie_credits`)
    ]);
    const getFilms = credits => (credits.crew||[]).filter(m => m.job==='Director' && m.vote_count > 100);
    const films1 = getFilms(c1), films2 = getFilms(c2);
    const avgRating = arr => arr.length ? (arr.reduce((s,m)=>s+(m.vote_average||0),0)/arr.length).toFixed(1) : '—';
    const maxRevenue = arr => Math.max(...arr.map(m=>m.revenue||0));
    const fmt = n => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : n>0 ? `$${n.toLocaleString()}` : '—';
    const bestFilm = arr => arr.sort((a,b)=>b.vote_average-a.vote_average)[0];
    
    const buildCol = (dir, films) => {
      const best = bestFilm([...films]);
      return `
        <div class="compare-col">
          <div class="compare-poster-wrap" style="text-align:center">
            ${dir.photo ? `<img src="${IMG(dir.photo,'w185')}" alt="${escHtml(dir.name)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 8px">` : ''}
          </div>
          <div class="compare-col-title">${escHtml(dir.name)}</div>
          <div class="compare-stat-row"><span class="compare-stat-val">${films.length} films</span></div>
          <div class="compare-stat-row"><span class="compare-stat-val">★ ${avgRating(films)}</span></div>
          <div class="compare-stat-row"><span class="compare-stat-val" style="font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">${best ? escHtml(best.title) : '—'}</span></div>
        </div>`;
    };
    grid.innerHTML = `
      ${buildCol(duelDirectors[0], films1)}
      <div class="compare-vs-center" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:0 10px">
        <div style="font-family:monospace;font-size:9px;letter-spacing:1px;color:var(--text-muted)">FILMS</div>
        <div style="font-family:monospace;font-size:9px;letter-spacing:1px;color:var(--text-muted)">AVG RATING</div>
        <div style="font-family:monospace;font-size:9px;letter-spacing:1px;color:var(--text-muted)">BEST FILM</div>
      </div>
      ${buildCol(duelDirectors[1], films2)}`;
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:24px;grid-column:1/-1;font-family:monospace">Failed to load.</p>';
  }
});

$('closeDirDuel').addEventListener('click', () => { $('directorDuelModal').classList.add('hidden'); document.body.style.overflow = ''; });
$('directorDuelBackdrop').addEventListener('click', () => { $('directorDuelModal').classList.add('hidden'); document.body.style.overflow = ''; });

// Add Director Duel button to compare bar
const compareBarInner = document.querySelector('.compare-bar-inner');
if (compareBarInner) {
  const duelBtn = document.createElement('button');
  duelBtn.className = 'compare-clear-btn';
  duelBtn.title = 'Director Duel';
  duelBtn.textContent = '⚔ Duel';
  duelBtn.addEventListener('click', openDirectorDuel);
  compareBarInner.appendChild(duelBtn);
}

/* =====================================================
   FEATURE 12 — NOTIFICATION REMINDERS (Upcoming Films)
===================================================== */
let reminders = JSON.parse(localStorage.getItem('mv_reminders') || '{}');

function saveReminders() { localStorage.setItem('mv_reminders', JSON.stringify(reminders)); }

async function toggleReminder(movie) {
  const id = movie.id;
  if (reminders[id]) {
    delete reminders[id];
    saveReminders();
    showToast(`Reminder removed for "${movie.title}"`, 'info');
    return;
  }
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      reminders[id] = { title: movie.title, date: movie.release_date, poster: movie.poster_path };
      saveReminders();
      showToast(`🔔 Reminder set for "${movie.title}" (${toYear(movie.release_date)})`, 'success');
      // Schedule notification if release date is in the future
      const releaseDate = movie.release_date ? new Date(movie.release_date) : null;
      if (releaseDate && releaseDate > new Date()) {
        const delay = releaseDate.getTime() - Date.now();
        if (delay < 7 * 24 * 60 * 60 * 1000) { // Only if within 7 days
          setTimeout(() => {
            new Notification(`🎬 "${movie.title}" is out now!`, {
              body: 'Available in cinemas today. Open The Film Oracle to explore.',
              icon: IMG(movie.poster_path, 'w92') || ''
            });
          }, delay);
        }
      }
    } else {
      showToast('Notification permission denied', 'info');
    }
  } else {
    reminders[id] = { title: movie.title, date: movie.release_date };
    saveReminders();
    showToast(`🔔 Reminder saved for "${movie.title}"`, 'success');
  }
}

function hasReminder(movieId) { return !!reminders[movieId]; }

/* =====================================================
   PATCH openModal to capture details + recently viewed
===================================================== */
// Replace openModal with a version that captures details for secondary actions
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
    
    // Cache for secondary action injection + track recently viewed
    _lastModalDetails = details;
    addToRecentlyViewed({
      id: details.id,
      title: details.title,
      poster_path: details.poster_path,
      release_date: details.release_date,
      vote_average: details.vote_average,
      genre_ids: (details.genres || []).map(g => g.id)
    });

    const trailer   = (videos.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const allVideos = (videos.results || []).filter(v => v.site === 'YouTube');
    const genres    = (details.genres || []).map(g => `<span class="genre-badge">${escHtml(g.name)}</span>`).join('');
    const director  = (credits.crew || []).find(c => c.job === 'Director');
    const topCast   = (credits.cast || []).slice(0, 8);
    const isFav     = favorites.some(f => f.id === id);
    const isWatched = watchedList.includes(id);
    const myRating  = personalRatings[id] || 0;
    const backdrop  = IMG(details.backdrop_path, 'w1280');
    const poster    = IMG(details.poster_path) || FALLBACK;

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

    const fmt = n => n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n > 0 ? `$${n.toLocaleString()}` : null;
    const budgetStr = fmt(details.budget);
    const revenueStr = fmt(details.revenue);
    const financeHtml = (budgetStr || revenueStr) ? `
      <div class="modal-finance-row">
        ${budgetStr ? `<div class="modal-finance-item"><span class="modal-finance-label">Budget</span><span class="modal-finance-val">${budgetStr}</span></div>` : ''}
        ${revenueStr ? `<div class="modal-finance-item"><span class="modal-finance-label">Box Office</span><span class="modal-finance-val green">${revenueStr}</span></div>` : ''}
      </div>` : '';

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
          ${director ? `<div class="modal-director">Directed by <button class="modal-director-link" data-director-id="${director.id}" data-director-name="${escHtml(director.name)}"><strong>${escHtml(director.name)}</strong> <span class="director-films-hint">→ All Films</span></button></div>` : ''}
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
          <div id="modalOmdbScores" class="omdb-scores-row is-loading"><span class="omdb-scores-loading"><span class="search-spinner" style="width:10px;height:10px;border-width:1.5px"></span>Loading scores…</span></div>
          <div id="modalSubtitles" class="modal-subtitles-wrap" style="display:none"></div>
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
            <button class="modal-diary-btn" id="modalDiaryBtn" title="Add to Diary">
              <span>📓</span><span>Diary</span>
            </button>
            <button class="modal-stream-btn" id="modalStreamBtn" title="Where to Watch">
              <span>▶</span><span>Stream</span>
            </button>
            <button class="modal-share-btn" id="modalShareBtn" title="Share Film Card">
              <span>↗</span><span>Share</span>
            </button>
          </div>
          <div class="modal-secondary-actions" id="modalSecondaryActions"></div>
        </div>
      </div>
      <div class="modal-body-content">
        ${details.overview ? `<p class="modal-overview">${escHtml(details.overview)}</p>` : ''}
        ${financeHtml}
        <div id="modalWikiSection"></div>
        ${castHtml ? `<h4 class="modal-section-title">Cast</h4><div class="modal-cast-grid">${castHtml}</div>` : ''}
        ${trailer ? `<h4 class="modal-section-title">Trailer</h4><div><iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>` : ''}
        ${allVideos.length > 1 ? `<button class="modal-all-videos-btn" id="modalAllVideosBtn">🎬 View All ${allVideos.length} Videos</button>` : ''}
      </div>
    `;

    // Wire inline star rating
    let currentModalRating = myRating;
    modalBody.querySelectorAll('.modal-star').forEach((btn, idx) => {
      btn.addEventListener('mouseenter', () => { modalBody.querySelectorAll('.modal-star').forEach((b,i) => b.classList.toggle('hover', i<=idx)); });
      btn.addEventListener('mouseleave', () => { modalBody.querySelectorAll('.modal-star').forEach(b => b.classList.remove('hover')); });
      btn.addEventListener('click', () => {
        const v = parseInt(btn.dataset.v);
        currentModalRating = v;
        personalRatings[id] = v;
        localStorage.setItem('mv_ratings', JSON.stringify(personalRatings));
        modalBody.querySelectorAll('.modal-star').forEach((b,i) => b.classList.toggle('active', i<v));
        const txt = modalBody.querySelector('.modal-my-rating-text');
        if (txt) { txt.textContent = RATING_LABELS[v]; txt.classList.remove('muted'); }
        showToast(`Rated "${details.title}" ${v}★`, 'star');
        refreshCardRating(id);
      });
    });

    $('modalWatchlistBtn').addEventListener('click', () => {
      toggleFavorite(details);
      const now = favorites.some(f => f.id === details.id);
      $('modalWatchlistBtn').classList.toggle('added', now);
      $('modalWatchlistBtn').querySelector('span').textContent = now ? '✓ In Watchlist' : '+ Watchlist';
      updateHeroFavBtn(heroCurrentId);
    });

    $('modalWatchedBtn').addEventListener('click', () => {
      toggleWatched(details.id, details.title);
      const now = watchedList.includes(details.id);
      $('modalWatchedBtn').classList.toggle('watched', now);
      $('modalWatchedBtn').querySelector('span').textContent = now ? '✓ Watched' : 'Mark Watched';
      updateHeroWatchedBtn(heroCurrentId);
      refreshCardWatchedState(details.id);
      // Refresh because-you-watched
      loadBecauseYouWatched();
    });

    $('modalDiaryBtn').addEventListener('click', () => {
      closeModal();
      const section = $('diary-section');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => openDiaryForm(details), 400);
    });

    $('modalStreamBtn').addEventListener('click', () => openWatchProviders(id, details.title));
    $('modalShareBtn').addEventListener('click', () => openShareCard(details));

    // All videos button
    const allVidsBtn = $('modalAllVideosBtn');
    if (allVidsBtn) allVidsBtn.addEventListener('click', () => openTrailerGallery(id, details.title));

    // Director filmography
    const dirLink = modalBody.querySelector('.modal-director-link');
    if (dirLink) dirLink.addEventListener('click', () => openDirectorFilmography(parseInt(dirLink.dataset.directorId), dirLink.dataset.directorName));

    // Secondary actions (collection, reminder)
    const secActions = $('modalSecondaryActions');
    if (secActions) {
      if (details.belongs_to_collection) {
        const colBtn = document.createElement('button');
        colBtn.className = 'modal-secondary-btn';
        colBtn.innerHTML = `<span>📽</span><span>View "${escHtml(details.belongs_to_collection.name)}"</span>`;
        colBtn.addEventListener('click', () => openCollection(details.belongs_to_collection.id, details.belongs_to_collection.name));
        secActions.appendChild(colBtn);
      }
      const isUpcoming = details.release_date && new Date(details.release_date) > new Date();
      if (isUpcoming) {
        const remBtn = document.createElement('button');
        const hasR = hasReminder(id);
        remBtn.className = 'modal-secondary-btn modal-remind-btn' + (hasR ? ' active' : '');
        remBtn.innerHTML = `<span>🔔</span><span>${hasR ? 'Reminder Set ✓' : 'Remind Me'}</span>`;
        remBtn.addEventListener('click', () => {
          toggleReminder(details);
          const nowHas = hasReminder(id);
          remBtn.classList.toggle('active', nowHas);
          remBtn.querySelector('span:last-child').textContent = nowHas ? 'Reminder Set ✓' : 'Remind Me';
        });
        secActions.appendChild(remBtn);
      }
    }

    renderSimilar(similar.results || [], id);

    // ---- Async enrichments (non-blocking) ----
    enrichModalWithOMDB(details);
    enrichModalWithSubtitles(details.imdb_id, details.title, id);
    if (director) enrichModalWithWikipedia(director.name, 'director');

  } catch(e) {
    modalBody.innerHTML = `<div style="padding:44px;text-align:center;color:var(--text-muted);font-size:13px;font-family:monospace">Could not load film details.</div>`;
    console.error('openModal:', e);
  }
}

/* =====================================================
   ENRICH MODAL — OMDB (Rotten Tomatoes + Metacritic)
===================================================== */
const OMDB_KEY = ''; // Users can set their own key — we gracefully handle absence

async function enrichModalWithOMDB(details) {
  const container = document.getElementById('modalOmdbScores');
  if (!container) return;

  // Use TMDB's vote average as the "TMDB" score; try OMDB for RT + MC
  const imdbId = details.imdb_id;
  if (!imdbId || !OMDB_KEY) {
    // Fallback: just show the TMDB score nicely
    container.classList.remove('is-loading');
    container.innerHTML = `
      <div class="omdb-score-badge imdb" title="TMDB Community Rating">
        <span class="score-icon">🎬</span>
        <span class="score-val">${toRating(details.vote_average)}</span>
        <span class="score-src">TMDB</span>
      </div>
      <div class="omdb-score-badge" title="Based on ${(details.vote_count||0).toLocaleString()} votes">
        <span class="score-icon">🗳️</span>
        <span class="score-val">${(details.vote_count||0).toLocaleString()}</span>
        <span class="score-src">Votes</span>
      </div>
      ${details.popularity ? `<div class="omdb-score-badge" title="Popularity score">
        <span class="score-icon">🔥</span>
        <span class="score-val">${Math.round(details.popularity)}</span>
        <span class="score-src">Pop.</span>
      </div>` : ''}
    `;
    return;
  }

  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_KEY}`);
    const data = await res.json();
    if (data.Response === 'False') throw new Error('OMDB miss');
    const ratings = data.Ratings || [];
    const rt = ratings.find(r => r.Source === 'Rotten Tomatoes');
    const mc = ratings.find(r => r.Source === 'Metacritic');
    const imdb = data.imdbRating;
    container.classList.remove('is-loading');
    container.innerHTML = `
      ${imdb && imdb !== 'N/A' ? `<div class="omdb-score-badge imdb" title="IMDb Rating"><span class="score-icon">⭐</span><span class="score-val">${imdb}</span><span class="score-src">IMDb</span></div>` : ''}
      ${rt ? `<div class="omdb-score-badge rt" title="Rotten Tomatoes"><span class="score-icon">🍅</span><span class="score-val">${rt.Value}</span><span class="score-src">RT</span></div>` : ''}
      ${mc ? `<div class="omdb-score-badge mc" title="Metacritic"><span class="score-icon">🎭</span><span class="score-val">${mc.Value}</span><span class="score-src">MC</span></div>` : ''}
      <div class="omdb-score-badge imdb" title="TMDB Rating"><span class="score-icon">🎬</span><span class="score-val">${toRating(details.vote_average)}</span><span class="score-src">TMDB</span></div>
    `;
  } catch {
    container.classList.remove('is-loading');
    container.innerHTML = `
      <div class="omdb-score-badge imdb"><span class="score-icon">🎬</span><span class="score-val">${toRating(details.vote_average)}</span><span class="score-src">TMDB</span></div>
    `;
  }
}

/* =====================================================
   SUBTITLE LANGUAGES — via TMDB translations endpoint
   (no extra API key, no CORS issues, always works)
===================================================== */

// Full ISO 639-1 → display name map
const SUBTITLE_LANG_NAMES = {
  en:'English', es:'Spanish', fr:'French', de:'German', it:'Italian', pt:'Portuguese',
  'pt-BR':'Portuguese (BR)', zh:'Chinese', 'zh-CN':'Chinese (S)', 'zh-TW':'Chinese (T)',
  ja:'Japanese', ko:'Korean', ar:'Arabic', ru:'Russian', hi:'Hindi', nl:'Dutch',
  pl:'Polish', tr:'Turkish', sv:'Swedish', da:'Danish', nb:'Norwegian', fi:'Finnish',
  cs:'Czech', hu:'Hungarian', ro:'Romanian', el:'Greek', he:'Hebrew', id:'Indonesian',
  th:'Thai', vi:'Vietnamese', uk:'Ukrainian', fa:'Persian', bn:'Bengali', ms:'Malay',
  sk:'Slovak', bg:'Bulgarian', hr:'Croatian', sr:'Serbian', sl:'Slovenian',
  lt:'Lithuanian', lv:'Latvian', et:'Estonian', ca:'Catalan', eu:'Basque',
  is:'Icelandic', ga:'Irish', cy:'Welsh', af:'Afrikaans', sw:'Swahili',
  ta:'Tamil', te:'Telugu', ml:'Malayalam', kn:'Kannada', gu:'Gujarati',
  pa:'Punjabi', mr:'Marathi', ur:'Urdu', ne:'Nepali', si:'Sinhala',
  my:'Burmese', km:'Khmer', lo:'Lao', mn:'Mongolian', ka:'Georgian',
  az:'Azerbaijani', kk:'Kazakh', uz:'Uzbek', hy:'Armenian', mk:'Macedonian',
  sq:'Albanian', bs:'Bosnian', gl:'Galician', lb:'Luxembourgish',
  'no':'Norwegian', 'zh-Hans':'Chinese (S)', 'zh-Hant':'Chinese (T)',
};

async function enrichModalWithSubtitles(imdbId, title, movieId) {
  const container = document.getElementById('modalSubtitles');
  if (!container) return;

  try {
    // Use TMDB translations — this tells us every language the film has
    // official data for, which strongly correlates with subtitle availability.
    // This uses the same API key already in use — zero extra setup.
    const data = await apiFetch(`/movie/${movieId}/translations`);
    const translations = data.translations || [];

    if (!translations.length) return;

    // Extract unique language codes, prioritising ones with title/overview data
    const langSet = new Set();
    const richLangs = new Set(); // have both title and overview

    translations.forEach(t => {
      const code = t.iso_639_1;
      if (!code) return;
      langSet.add(code);
      if (t.data?.title && t.data?.overview) richLangs.add(code);
    });

    // Put rich (full translation) languages first, then others
    const rich = [...richLangs];
    const partial = [...langSet].filter(l => !richLangs.has(l));
    const allLangs = [...rich, ...partial];

    if (!allLangs.length) return;

    container.style.display = '';
    container.innerHTML = `
      <div class="modal-subtitles-label">🌐 Available Languages <span style="opacity:0.5;font-size:8px;letter-spacing:0.5px">(${allLangs.length} translations)</span></div>
      <div class="modal-subtitle-chips">
        ${allLangs.slice(0, 20).map(l => {
          const isRich = richLangs.has(l);
          const name = SUBTITLE_LANG_NAMES[l] || l.toUpperCase();
          const tip = isRich ? 'Full translation (title + overview)' : 'Partial translation';
          return `<span class="modal-subtitle-chip${l === 'en' ? ' native' : ''}" title="${tip}">${name}</span>`;
        }).join('')}
        ${allLangs.length > 20 ? `<span class="modal-subtitle-chip" style="opacity:0.5">+${allLangs.length - 20} more</span>` : ''}
      </div>
    `;
  } catch (err) {
    console.debug('Subtitle/translations fetch failed:', err.message);
  }
}

/* =====================================================
   ENRICH MODAL — WIKIPEDIA DIRECTOR BIO + AWARDS
===================================================== */
async function enrichModalWithWikipedia(directorName, role = 'director') {
  const container = document.getElementById('modalWikiSection');
  if (!container) return;

  try {
    // Wikipedia API search
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(directorName + ' film director')}&srlimit=1&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    const page = (searchData.query?.search || [])[0];
    if (!page) return;

    // Get extract
    const extractRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&pageids=${page.pageid}&prop=extracts&exintro=true&explaintext=true&exsentences=4&format=json&origin=*`
    );
    const extractData = await extractRes.json();
    const pageData = Object.values(extractData.query?.pages || {})[0];
    const extract = pageData?.extract?.trim() || '';
    if (!extract) return;

    // Try to find Oscar mentions in snippet
    const awards = [];
    if (/oscar|academy award/i.test(page.snippet + extract)) awards.push('🏆 Academy Award');
    if (/cannes|palme d.or/i.test(page.snippet + extract)) awards.push('🌴 Cannes');
    if (/bafta/i.test(page.snippet + extract)) awards.push('🎭 BAFTA');
    if (/golden globe/i.test(page.snippet + extract)) awards.push('🌟 Golden Globe');
    if (/venice/i.test(page.snippet + extract)) awards.push('🦁 Venice');

    container.innerHTML = `
      <div class="modal-wiki-section">
        <div class="modal-wiki-title">📖 Director — ${escHtml(directorName)}</div>
        ${awards.length ? `<div class="modal-wiki-awards">${awards.map(a => `<span class="wiki-award-chip">${escHtml(a)}</span>`).join('')}</div>` : ''}
        <div class="modal-wiki-bio" id="wikiExtractText">${escHtml(extract)}</div>
        <button class="modal-wiki-read-more" id="wikiReadMore">Read more →</button>
      </div>
    `;

    // Expand/collapse
    const bioEl = document.getElementById('wikiExtractText');
    const readMoreBtn = document.getElementById('wikiReadMore');
    if (bioEl && readMoreBtn) {
      readMoreBtn.addEventListener('click', () => {
        bioEl.classList.toggle('expanded');
        readMoreBtn.textContent = bioEl.classList.contains('expanded') ? 'Collapse ↑' : 'Read more →';
      });
    }
  } catch {
    // Silent fail
  }
}

/* =====================================================
   REST COUNTRIES — World Cinema enrichment
===================================================== */
const _countryCache = {};
async function fetchCountryInfo(isoCode) {
  if (_countryCache[isoCode]) return _countryCache[isoCode];
  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${isoCode}?fields=name,flags,languages,capital,population`);
    if (!res.ok) return null;
    const raw = await res.json();
    // API returns array for alpha endpoint
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (!data || !data.name) return null;
    _countryCache[isoCode] = data;
    return data;
  } catch { return null; }
}

// Map TMDB language codes to ISO 3166-1 alpha-2 for REST Countries
const LANG_TO_COUNTRY = {
  ko:'KR', ja:'JP', fr:'FR', hi:'IN', es:'ES', it:'IT', zh:'CN',
  de:'DE', pt:'BR', tr:'TR', ru:'RU', en:'US',
};

async function enrichWorldCinemaWithCountry(lang) {
  const badge = document.getElementById('worldCountryBadge');
  if (!badge) return;

  const iso = LANG_TO_COUNTRY[lang];
  if (!iso) { badge.style.display = 'none'; return; }

  // Show loading state
  badge.style.display = 'flex';
  badge.innerHTML = `<span style="font-family:monospace;font-size:10px;color:var(--text-muted);opacity:0.6">Loading country info…</span>`;

  const info = await fetchCountryInfo(iso);
  if (!info) { badge.style.display = 'none'; return; }

  const langs = Object.values(info.languages || {}).slice(0, 2).join(', ');
  const flag = info.flags?.png || info.flags?.svg || '';
  const pop = info.population;
  const popStr = pop >= 1e9 ? `${(pop/1e9).toFixed(1)}B` : pop >= 1e6 ? `${(pop/1e6).toFixed(0)}M` : pop ? pop.toLocaleString() : '—';
  const capital = (info.capital || [])[0] || '';

  badge.innerHTML = `
    ${flag ? `<img src="${escHtml(flag)}" alt="${escHtml(info.name?.common || '')}" loading="lazy" onerror="this.style.display='none'">` : ''}
    <div>
      <div class="country-name">${escHtml(info.name?.common || iso)}</div>
      <div class="country-lang">${langs ? `🗣 ${escHtml(langs)}` : ''}${capital ? ` · 🏛 ${escHtml(capital)}` : ''} · 👥 ${popStr}</div>
    </div>
  `;
}

/* =====================================================
   NOW PLAYING — LOCALE-AWARE LOADING
===================================================== */
async function loadNowPlayingLocale() {
  const locale = navigator.language || 'en-US';
  const regionCode = locale.includes('-') ? locale.split('-')[1] : null;
  const localeBadge = document.getElementById('nowPlayingLocale');

  const params = {
    sort_by: 'popularity.desc',
    'vote_count.gte': 100,
  };
  if (regionCode && regionCode !== 'US') {
    params.region = regionCode;
    if (localeBadge) {
      localeBadge.textContent = `📍 ${regionCode}`;
      localeBadge.classList.remove('hidden');
    }
  }

  renderSkeletons('nowPlaying', 10);
  try {
    const data = await apiFetch('/movie/now_playing', params);
    displayMovies(data.results, 'nowPlaying');
  } catch {
    const el = document.getElementById('nowPlaying');
    if (el) el.innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">Failed to load.</p>';
  }
}

/* =====================================================
   INIT NEW FEATURES
===================================================== */
renderRecentlyViewed();
loadBecauseYouWatched();

// Stats dashboard renders when section scrolled into view (lazy)
let statsRendered = false;
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && !statsRendered) {
      statsRendered = true;
      renderStatsDashboard();
    }
  });
}, { threshold: 0.1 });
const statsSection = $('stats-section');
if (statsSection) statsObserver.observe(statsSection);

// Add Director Duel to header shortcuts
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (['INPUT','TEXTAREA'].includes(tag)) return;
  if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (!compareMode) { compareToggleBtn.click(); }
    openDirectorDuel();
  }
}, false);

// Update SPY_MAP for new sections
SPY_MAP.push(
  ['recently-viewed', '#recently-viewed'],
  ['because-section', '#section-topRated'],
  ['stats-section', '#stats-section']
);

// Update shortcuts modal content
const shortcutsGrid = document.querySelector('.shortcuts-grid');
if (shortcutsGrid) {
  shortcutsGrid.insertAdjacentHTML('beforeend', `
    <div class="shortcut-row"><kbd>D</kbd><span>Director Duel</span></div>
  `);
}

/* =====================================================
   UPDATE SPY_MAP for new sections
===================================================== */
SPY_MAP.push(
  ['film-dna',          '#film-dna'],
  ['universe-map',      '#universe-map'],
  ['surprise-me',       '#surprise-me'],
  ['taste-compat',      '#taste-compat'],
  ['budget-scatter',    '#budget-scatter'],
  ['on-this-day',       '#on-this-day'],
  ['awards-tracker',    '#awards-tracker'],
  ['filming-locations', '#filming-locations'],
  ['lang-learning',     '#lang-learning']
);

/* =====================================================
   FEATURE 1 — FILM DNA MATCHER
===================================================== */
const dnaSeeds = [null, null, null];
let _dnaActiveSlot = null;

function initDNA() {
  const slots = document.querySelectorAll('.dna-seed-slot');
  slots.forEach(slot => {
    slot.addEventListener('click', () => {
      if (slot.classList.contains('filled')) return;
      _dnaActiveSlot = parseInt(slot.dataset.slot);
      document.getElementById('dnaSearchWrap').classList.remove('hidden');
      document.getElementById('dnaSearchInput').focus();
    });
  });

  const inp = document.getElementById('dnaSearchInput');
  let _dnaTimer = null;
  inp.addEventListener('input', () => {
    clearTimeout(_dnaTimer);
    const q = inp.value.trim();
    if (q.length < 2) { document.getElementById('dnaSearchResults').innerHTML = ''; return; }
    _dnaTimer = setTimeout(() => searchDNAFilm(q), 280);
  });

  document.getElementById('dnaAnalyzeBtn').addEventListener('click', analyzeDNA);
}

async function searchDNAFilm(q) {
  const data = await apiFetch('/search/movie', { query: q, page: 1 });
  const results = (data.results || []).filter(m => m.poster_path).slice(0, 6);
  const container = document.getElementById('dnaSearchResults');
  container.innerHTML = results.map(m => `
    <div class="dna-result-item" data-id="${m.id}" data-title="${escHtml(m.title)}" data-poster="${m.poster_path || ''}">
      <img src="${IMG(m.poster_path,'w92')}" alt="">
      <span>${escHtml(m.title)} (${toYear(m.release_date)})</span>
    </div>`).join('');
  container.querySelectorAll('.dna-result-item').forEach(el => {
    el.addEventListener('click', () => {
      if (_dnaActiveSlot === null) return;
      const movie = { id: parseInt(el.dataset.id), title: el.dataset.title, poster_path: el.dataset.poster };
      dnaSeeds[_dnaActiveSlot] = movie;
      renderDNASlot(_dnaActiveSlot, movie);
      document.getElementById('dnaSearchWrap').classList.add('hidden');
      document.getElementById('dnaSearchResults').innerHTML = '';
      document.getElementById('dnaSearchInput').value = '';
      _dnaActiveSlot = null;
      document.getElementById('dnaAnalyzeBtn').disabled = dnaSeeds.every(s => !s);
    });
  });
}

function renderDNASlot(idx, movie) {
  const slot = document.querySelector(`.dna-seed-slot[data-slot="${idx}"]`);
  slot.classList.add('filled');
  slot.innerHTML = `
    <img src="${IMG(movie.poster_path,'w185')}" alt="${escHtml(movie.title)}">
    <div class="dna-slot-remove" data-slot="${idx}">✕</div>`;
  slot.querySelector('.dna-slot-remove').addEventListener('click', e => {
    e.stopPropagation();
    dnaSeeds[idx] = null;
    slot.classList.remove('filled');
    slot.innerHTML = `<span class="dna-slot-plus">＋</span><span class="dna-slot-label">Add film</span>`;
    document.getElementById('dnaAnalyzeBtn').disabled = dnaSeeds.every(s => !s);
    document.getElementById('dnaResults').classList.add('hidden');
  });
}

async function analyzeDNA() {
  const seeds = dnaSeeds.filter(Boolean);
  if (!seeds.length) return;
  const btn = document.getElementById('dnaAnalyzeBtn');
  btn.textContent = '🧬 Analyzing…';
  btn.disabled = true;

  try {
    // Fetch details for each seed
    const details = await Promise.all(seeds.map(s => apiFetch(`/movie/${s.id}`, { append_to_response: 'credits' })));

    // Extract DNA: genres, directors, decade
    const genreCounts = {}, directorNames = [], decades = [];
    details.forEach(d => {
      (d.genres || []).forEach(g => { genreCounts[g.name] = (genreCounts[g.name] || 0) + 1; });
      const dir = (d.credits?.crew || []).find(c => c.job === 'Director');
      if (dir) directorNames.push(dir.name);
      if (d.release_date) decades.push(Math.floor(parseInt(d.release_date) / 10) * 10);
    });

    const topGenres = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]).slice(0,4).map(([g]) => g);
    const topDecade = decades.length ? Math.round(decades.reduce((a,b) => a+b,0) / decades.length) : 2000;
    const avgRating = details.reduce((a,d) => a + (d.vote_average || 0), 0) / details.length;

    // Build DNA profile tags
    const profileEl = document.getElementById('dnaProfile');
    profileEl.innerHTML = [
      ...topGenres.map(g => `<span class="dna-tag genre">${g}</span>`),
      ...directorNames.map(n => `<span class="dna-tag director">🎬 ${escHtml(n)}</span>`),
      `<span class="dna-tag era">📅 ${topDecade}s</span>`,
      `<span class="dna-tag era">⭐ ${avgRating.toFixed(1)}+ avg</span>`
    ].join('');

    // Fetch genre IDs for the top genres
    const genreIdsMap = { Action:28, Drama:18, Comedy:35, Horror:27, Romance:10749, 'Science Fiction':878,
      Thriller:53, Adventure:12, Fantasy:14, History:36, Documentary:99, Family:10751, Mystery:9648,
      Crime:80, Western:37, War:10752, Animation:16 };
    const genreIds = topGenres.map(g => genreIdsMap[g]).filter(Boolean).slice(0,2).join(',');

    // Find DNA matches
    const matchData = await apiFetch('/discover/movie', {
      with_genres: genreIds || '18',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 500,
      'primary_release_date.gte': `${topDecade - 5}-01-01`,
      'primary_release_date.lte': `${topDecade + 15}-12-31`,
      'vote_average.gte': Math.max(6, avgRating - 1),
      page: 1
    });

    // Filter out seed films
    const seedIds = new Set(seeds.map(s => s.id));
    const matches = (matchData.results || []).filter(m => !seedIds.has(m.id) && m.poster_path).slice(0, 20);

    displayMovies(matches, 'dnaMatchRow');
    document.getElementById('dnaResults').classList.remove('hidden');
    document.getElementById('dnaResults').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch(e) {
    showToast('DNA analysis failed', 'default');
  } finally {
    btn.textContent = '🧬 Analyze DNA';
    btn.disabled = false;
  }
}

initDNA();

/* =====================================================
   FEATURE 2 — CINEMATIC UNIVERSE MAP
===================================================== */
let _universeNodes = [], _universeEdges = [], _universeDrag = null, _universeAnimFrame = null;
let _universeOffsetX = 0, _universeOffsetY = 0, _universeScale = 1;

function initUniverseMap() {
  const inp = document.getElementById('universeSearchInput');
  const auto = document.getElementById('universeAutocomplete');
  const btn = document.getElementById('universeExploreBtn');
  let _ut = null;

  inp.addEventListener('input', () => {
    clearTimeout(_ut);
    const q = inp.value.trim();
    if (q.length < 2) { auto.classList.add('hidden'); return; }
    _ut = setTimeout(async () => {
      const d = await apiFetch('/search/movie', { query: q, page: 1 });
      const items = (d.results || []).filter(m => m.poster_path).slice(0, 5);
      auto.innerHTML = items.map(m => `<div class="dna-result-item" data-id="${m.id}" data-title="${escHtml(m.title)}" data-poster="${m.poster_path}">
        <img src="${IMG(m.poster_path,'w92')}" alt=""><span>${escHtml(m.title)} (${toYear(m.release_date)})</span></div>`).join('');
      auto.classList.remove('hidden');
      auto.querySelectorAll('.dna-result-item').forEach(el => {
        el.addEventListener('click', () => {
          inp.value = el.dataset.title;
          auto.classList.add('hidden');
          buildUniverse(parseInt(el.dataset.id), el.dataset.title);
        });
      });
    }, 280);
  });

  btn.addEventListener('click', () => {
    const q = inp.value.trim();
    if (!q) return;
    auto.classList.add('hidden');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#universeAutocomplete') && !e.target.closest('#universeSearchInput')) {
      auto.classList.add('hidden');
    }
  });
}

async function buildUniverse(movieId, movieTitle) {
  const wrap = document.getElementById('universeCanvasWrap');
  wrap.style.display = 'block';
  const canvas = document.getElementById('universeCanvas');
  const tooltip = document.getElementById('universeTooltip');
  canvas.width = wrap.clientWidth * window.devicePixelRatio;
  canvas.height = 500 * window.devicePixelRatio;
  canvas.style.height = '500px';
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const W = wrap.clientWidth, H = 500;

  ctx.fillStyle = 'rgba(8,8,14,0.98)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(0,229,204,0.6)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Building universe…', W/2, H/2);

  try {
    const [details, credits] = await Promise.all([
      apiFetch(`/movie/${movieId}`),
      apiFetch(`/movie/${movieId}/credits`)
    ]);

    const nodes = [];
    const edges = [];
    const cx = W/2, cy = H/2;

    // Centre node — the film
    nodes.push({ id: `m-${movieId}`, label: movieTitle, type: 'film', x: cx, y: cy, vx:0, vy:0, movieId });

    // Director(s)
    const directors = (credits.crew || []).filter(c => c.job === 'Director').slice(0,2);
    directors.forEach((dir, i) => {
      const angle = (i / Math.max(directors.length,1)) * Math.PI * 2;
      const n = { id: `p-${dir.id}`, label: dir.name, type: 'person', x: cx + Math.cos(angle)*120, y: cy + Math.sin(angle)*120, vx:0, vy:0, personId: dir.id };
      nodes.push(n);
      edges.push({ from: `m-${movieId}`, to: n.id });
    });

    // Top cast
    const cast = (credits.cast || []).slice(0,8);
    cast.forEach((actor, i) => {
      const angle = (i / cast.length) * Math.PI * 2;
      const dist = 180 + Math.random()*60;
      const n = { id: `p-${actor.id}`, label: actor.name, type: 'person', x: cx + Math.cos(angle)*dist, y: cy + Math.sin(angle)*dist, vx:0, vy:0, personId: actor.id };
      if (!nodes.find(nd => nd.id === n.id)) {
        nodes.push(n);
        edges.push({ from: `m-${movieId}`, to: n.id });
      }
    });

    // Fetch 1 extra film per director
    for (const dir of directors.slice(0,1)) {
      const films = await apiFetch('/discover/movie', { with_crew: dir.id, sort_by:'popularity.desc', page:1 });
      const relatedFilms = (films.results||[]).filter(m => m.id !== movieId && m.poster_path).slice(0,3);
      relatedFilms.forEach((m, i) => {
        const dirNode = nodes.find(n => n.id === `p-${dir.id}`);
        if (!dirNode) return;
        const angle = (i / relatedFilms.length) * Math.PI * 2;
        const n = { id: `m-${m.id}`, label: m.title, type: 'film', x: dirNode.x + Math.cos(angle)*120, y: dirNode.y + Math.sin(angle)*120, vx:0, vy:0, movieId: m.id };
        if (!nodes.find(nd => nd.id === n.id)) {
          nodes.push(n);
          edges.push({ from: `p-${dir.id}`, to: n.id });
        }
      });
    }

    _universeNodes = nodes;
    _universeEdges = edges;
    _universeOffsetX = 0; _universeOffsetY = 0; _universeScale = 1;

    // Force-directed simulation
    let simStep = 0;
    function simulate() {
      for (let i=0;i<3;i++) {
        // Repulsion
        for (let a=0;a<nodes.length;a++) for (let b=a+1;b<nodes.length;b++) {
          const dx=nodes[b].x-nodes[a].x, dy=nodes[b].y-nodes[a].y;
          const dist=Math.sqrt(dx*dx+dy*dy)||1;
          const force=2000/(dist*dist);
          nodes[a].vx-=dx/dist*force; nodes[a].vy-=dy/dist*force;
          nodes[b].vx+=dx/dist*force; nodes[b].vy+=dy/dist*force;
        }
        // Attraction along edges
        edges.forEach(e => {
          const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
          if (!a||!b) return;
          const dx=b.x-a.x, dy=b.y-a.y, dist=Math.sqrt(dx*dx+dy*dy)||1;
          const force=(dist-160)*0.01;
          a.vx+=dx/dist*force; a.vy+=dy/dist*force;
          b.vx-=dx/dist*force; b.vy-=dy/dist*force;
        });
        // Centre gravity
        nodes.forEach(n => { n.vx+=(cx-n.x)*0.002; n.vy+=(cy-n.y)*0.002; });
        // Integrate
        nodes.forEach(n => { n.vx*=0.85; n.vy*=0.85; n.x+=n.vx; n.y+=n.vy; });
      }
    }

    function drawUniverse() {
      ctx.clearRect(0,0,W,H);
      ctx.save();
      ctx.translate(_universeOffsetX, _universeOffsetY);
      ctx.scale(_universeScale, _universeScale);

      // Edges
      edges.forEach(e => {
        const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
        if (!a||!b) return;
        ctx.beginPath();
        ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
        ctx.strokeStyle='rgba(0,229,204,0.15)'; ctx.lineWidth=1;
        ctx.stroke();
      });

      // Nodes
      nodes.forEach(n => {
        const r = n.id===`m-${movieId}` ? 20 : n.type==='film' ? 14 : 10;
        const col = n.type==='film' ? '#00e5cc' : '#c4a0ff';
        ctx.beginPath();
        ctx.arc(n.x,n.y,r,0,Math.PI*2);
        ctx.fillStyle = n.id===`m-${movieId}` ? col : col+'40';
        ctx.fill();
        ctx.strokeStyle=col; ctx.lineWidth=1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle='rgba(240,234,214,0.85)';
        ctx.font=`${n.id===`m-${movieId}` ? 11 : 9}px 'DM Mono', monospace`;
        ctx.textAlign='center';
        const maxW = 80;
        let label = n.label;
        if (ctx.measureText(label).width > maxW) label = label.slice(0,10)+'…';
        ctx.fillText(label, n.x, n.y+r+12);
      });
      ctx.restore();

      if (simStep++ < 120) _universeAnimFrame = requestAnimationFrame(() => { simulate(); drawUniverse(); });
      else _universeAnimFrame = requestAnimationFrame(drawUniverse);
    }

    if (_universeAnimFrame) cancelAnimationFrame(_universeAnimFrame);
    drawUniverse();

    // Tooltip on hover
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - _universeOffsetX) / _universeScale;
      const my = (e.clientY - rect.top - _universeOffsetY) / _universeScale;
      const hit = nodes.find(n => Math.hypot(n.x-mx, n.y-my) < 22);
      if (hit) {
        tooltip.classList.remove('hidden');
        tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
        tooltip.style.top  = (e.clientY - rect.top - 8) + 'px';
        tooltip.textContent = hit.label + (hit.type==='film' ? ' 🎬' : ' 👤');
      } else {
        tooltip.classList.add('hidden');
      }
    };
    canvas.onclick = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - _universeOffsetX) / _universeScale;
      const my = (e.clientY - rect.top - _universeOffsetY) / _universeScale;
      const hit = nodes.find(n => n.type==='film' && Math.hypot(n.x-mx, n.y-my) < 22);
      if (hit?.movieId) openModal(hit.movieId);
    };

  } catch(err) {
    console.error('Universe build failed', err);
  }
}

if (document.getElementById("universeSearchInput")) initUniverseMap();

/* =====================================================
   FEATURE 3 — SURPRISE ME WHEEL
===================================================== */
(function initSurpriseWheel() {
  if (!document.getElementById("surpriseWheel")) return;
  const GENRES = [
    { id:28, name:'Action', color:'#e63946' },
    { id:35, name:'Comedy', color:'#f4a261' },
    { id:18, name:'Drama', color:'#457b9d' },
    { id:27, name:'Horror', color:'#6a0572' },
    { id:878, name:'Sci-Fi', color:'#00b4d8' },
    { id:53, name:'Thriller', color:'#2d6a4f' },
    { id:10749, name:'Romance', color:'#e76f51' },
    { id:16, name:'Animation', color:'#ffb703' },
    { id:12, name:'Adventure', color:'#06d6a0' },
    { id:9648, name:'Mystery', color:'#8338ec' },
    { id:80, name:'Crime', color:'#3d405b' },
    { id:14, name:'Fantasy', color:'#c77dff' },
  ];

  const canvas = document.getElementById('surpriseWheel');
  const ctx = canvas.getContext('2d');
  const cx = 150, cy = 150, r = 140;
  const slices = GENRES.length;
  const arc = (Math.PI * 2) / slices;
  let currentAngle = 0, spinning = false;

  function drawWheel(angle) {
    ctx.clearRect(0, 0, 300, 300);
    GENRES.forEach((g, i) => {
      const start = angle + i * arc - Math.PI/2;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = g.color + 'cc';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc/2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px DM Mono, monospace';
      ctx.fillText(g.name, r - 8, 3);
      ctx.restore();
    });

    // Centre circle
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI*2);
    ctx.fillStyle = 'var(--bg, #0a0a0e)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,229,204,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pointer triangle
    ctx.beginPath();
    ctx.moveTo(cx + r - 10, cy - 8);
    ctx.lineTo(cx + r + 10, cy);
    ctx.lineTo(cx + r - 10, cy + 8);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  drawWheel(0);

  document.getElementById('surpriseSpinBtn').addEventListener('click', () => {
    if (spinning) return;
    spinning = true;
    const totalAngle = Math.PI * 2 * (5 + Math.random() * 5);
    const duration = 3000;
    const start = performance.now();

    function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      currentAngle = eased * totalAngle;
      drawWheel(currentAngle);
      if (progress < 1) { requestAnimationFrame(animate); return; }

      // Determine winner
      const finalAngle = ((currentAngle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
      const winnerIdx = Math.floor(((Math.PI*1.5 - finalAngle + Math.PI*2) % (Math.PI*2)) / arc) % slices;
      const winner = GENRES[winnerIdx];
      spinning = false;
      loadSurpriseGenre(winner);
    }
    requestAnimationFrame(animate);
  });

  async function loadSurpriseGenre(genre) {
    const label = document.getElementById('surpriseGenreLabel');
    label.textContent = genre.name;
    label.style.color = genre.color;
    const result = document.getElementById('surpriseResult');
    result.classList.remove('hidden');
    renderSkeletons('surpriseRow', 10);
    try {
      const data = await apiFetch('/discover/movie', {
        with_genres: genre.id,
        sort_by: 'vote_average.desc',
        'vote_count.gte': 300,
        page: Math.floor(Math.random()*3)+1
      });
      displayMovies(data.results, 'surpriseRow');
    } catch(e) { showToast('Failed to load films', 'default'); }
  }
})();

/* =====================================================
   FEATURE 4 — TASTE COMPATIBILITY
===================================================== */
(function initTasteCompat() {
  if (!document.getElementById("tasteMyCode")) return;
  function buildTasteCode() {
    const genres = cineScore.genres || {};
    const watched = watchedList.slice(0,20).map(w => w.id || w);
    const payload = { genres, watched: watched.slice(0,10) };
    return btoa(JSON.stringify(payload)).replace(/=/g,'');
  }

  function decodeTasteCode(code) {
    try { return JSON.parse(atob(code + '==')); } catch { return null; }
  }

  function renderMyCode() {
    const code = buildTasteCode();
    const el = document.getElementById('tasteMyCode');
    if (el) el.textContent = code.slice(0,32) + (code.length > 32 ? '…' : '');
    el._fullCode = code;
  }

  renderMyCode();

  document.getElementById('tasteCopyBtn')?.addEventListener('click', () => {
    const el = document.getElementById('tasteMyCode');
    const code = el._fullCode || buildTasteCode();
    navigator.clipboard?.writeText(code).then(() => showToast('Code copied!', 'success'));
  });

  document.getElementById('tasteMatchBtn')?.addEventListener('click', async () => {
    const raw = document.getElementById('tastePartnerCode').value.trim();
    if (!raw) { showToast('Paste a friend\'s code first', 'default'); return; }
    const partner = decodeTasteCode(raw);
    if (!partner) { showToast('Invalid code', 'default'); return; }

    const mine = JSON.parse(atob(buildTasteCode() + '=='));
    // Find shared genres
    const myGenres = mine.genres || {}, partnerGenres = partner.genres || {};
    const allGenres = new Set([...Object.keys(myGenres), ...Object.keys(partnerGenres)]);
    let sharedScore = 0, totalScore = 0;
    allGenres.forEach(g => {
      const a = myGenres[g] || 0, b = partnerGenres[g] || 0;
      sharedScore += Math.min(a,b);
      totalScore += Math.max(a,b);
    });
    const compatibility = totalScore > 0 ? Math.round((sharedScore/totalScore)*100) : 50;
    const topSharedGenres = [...allGenres].filter(g => (myGenres[g]||0) > 0 && (partnerGenres[g]||0) > 0)
      .sort((a,b) => Math.min(myGenres[b]||0,partnerGenres[b]||0) - Math.min(myGenres[a]||0,partnerGenres[a]||0))
      .slice(0,3).map(g => getGenreName(parseInt(g))).filter(Boolean);

    const scoreBar = document.getElementById('tasteScoreBar');
    const emoji = compatibility >= 80 ? '🔥' : compatibility >= 60 ? '💑' : compatibility >= 40 ? '🤝' : '🎲';
    scoreBar.innerHTML = `
      <div class="taste-compat-score">${compatibility}% Match ${emoji}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
        ${topSharedGenres.length ? `Shared taste: <strong style="color:var(--teal)">${topSharedGenres.join(', ')}</strong>` : 'Different tastes — great for discovering new films!'}
      </div>`;

    // Find films matching both profiles
    const topGenreId = topSharedGenres[0] ? Object.keys({28:'Action',18:'Drama',35:'Comedy',878:'Sci-Fi',53:'Thriller',27:'Horror',10749:'Romance',12:'Adventure',14:'Fantasy',16:'Animation'}).find(id => ({28:'Action',18:'Drama',35:'Comedy',878:'Sci-Fi',53:'Thriller',27:'Horror',10749:'Romance',12:'Adventure',14:'Fantasy',16:'Animation'})[id] === topSharedGenres[0]) : '18';
    renderSkeletons('tasteMatchRow', 10);
    const data = await apiFetch('/discover/movie', {
      with_genres: topGenreId || '18',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 500,
      page: 1
    });
    displayMovies(data.results, 'tasteMatchRow');
    document.getElementById('tasteResults').classList.remove('hidden');
  });

  // Refresh code whenever watchlist/score changes
  window.addEventListener('storage', renderMyCode);
})();

/* =====================================================
   FEATURE 5 — BUDGET vs RATING SCATTER PLOT
===================================================== */
let _scatterMovies = [], _scatterGenre = '';

async function loadScatterData() {
  const genre = document.getElementById('scatterGenreFilter')?.value || '';
  _scatterGenre = genre;
  const canvas = document.getElementById('scatterCanvas');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth * window.devicePixelRatio;
  canvas.height = 480 * window.devicePixelRatio;
  canvas.style.height = '480px';
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const W = wrap.clientWidth, H = 480;

  ctx.fillStyle = 'rgba(8,8,14,0.5)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(0,229,204,0.5)'; ctx.font='12px monospace'; ctx.textAlign='center';
  ctx.fillText('Loading data…', W/2, H/2);

  try {
    // Fetch 5 pages of popular films with budget data
    const pages = await Promise.all([1,2,3,4,5].map(p => apiFetch('/discover/movie', {
      sort_by: 'popularity.desc',
      'vote_count.gte': 200,
      ...(genre ? { with_genres: genre } : {}),
      page: p
    })));
    const all = pages.flatMap(d => d.results||[]);
    // Fetch budget details for first 60
    const details = await Promise.all(all.slice(0,60).map(m => apiFetch(`/movie/${m.id}`).catch(()=>null)));
    _scatterMovies = details.filter(d => d && d.budget > 1000000 && d.vote_average > 0 && d.poster_path);
    drawScatter(W, H, ctx);
  } catch(e) { console.error(e); }
}

function drawScatter(W, H, ctx) {
  const movies = _scatterMovies;
  if (!movies.length) return;
  const pad = { left:60, right:20, top:20, bottom:50 };
  const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;

  const maxBudget = Math.max(...movies.map(m=>m.budget));
  const minBudget = Math.min(...movies.map(m=>m.budget));
  const maxRating = 10, minRating = 0;

  ctx.clearRect(0,0,W,H);

  // Background grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let i=0;i<=10;i++) {
    const y = pad.top + (i/10)*ph;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+pw,y); ctx.stroke();
    ctx.fillStyle='rgba(240,234,214,0.3)'; ctx.font='9px DM Mono, monospace'; ctx.textAlign='right';
    ctx.fillText((10-i).toFixed(0), pad.left-6, y+3);
  }
  for (let i=0;i<=5;i++) {
    const x = pad.left + (i/5)*pw;
    ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,pad.top+ph); ctx.stroke();
    ctx.fillStyle='rgba(240,234,214,0.3)'; ctx.font='9px DM Mono, monospace'; ctx.textAlign='center';
    ctx.fillText('$'+(((minBudget+(maxBudget-minBudget)*i/5)/1e6).toFixed(0))+'M', x, pad.top+ph+16);
  }

  // Axis labels
  ctx.fillStyle='rgba(240,234,214,0.5)'; ctx.font='10px DM Mono, monospace';
  ctx.textAlign='center';
  ctx.fillText('Budget (USD)', pad.left+pw/2, H-8);
  ctx.save(); ctx.translate(12, pad.top+ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('Rating', 0, 0); ctx.restore();

  // Dots
  movies.forEach(m => {
    const x = pad.left + ((m.budget - minBudget)/(maxBudget - minBudget)) * pw;
    const y = pad.top + (1 - (m.vote_average - minRating)/(maxRating - minRating)) * ph;
    const r = 5 + (m.vote_count/5000);
    const rating = m.vote_average;
    const hue = rating >= 7.5 ? 160 : rating >= 6 ? 45 : 0;
    ctx.beginPath();
    ctx.arc(x, y, Math.min(r, 14), 0, Math.PI*2);
    ctx.fillStyle = `hsla(${hue},70%,55%,0.65)`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue},80%,65%,0.9)`;
    ctx.lineWidth = 1; ctx.stroke();
    m._sx = x; m._sy = y; m._sr = Math.min(r, 14);
  });
}

function initScatterPlot() {
  const canvas = document.getElementById('scatterCanvas');
  const tooltip = document.getElementById('scatterTooltip');
  if (!canvas) return;

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width / window.devicePixelRatio);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height / window.devicePixelRatio);
    const hit = _scatterMovies.find(m => m._sx && Math.hypot(m._sx-mx, m._sy-my) < m._sr+4);
    if (hit) {
      tooltip.classList.remove('hidden');
      tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 40) + 'px';
      tooltip.innerHTML = `<strong>${escHtml(hit.title)}</strong><br>Budget: $${(hit.budget/1e6).toFixed(0)}M<br>Rating: ${hit.vote_average.toFixed(1)} ⭐`;
    } else {
      tooltip.classList.add('hidden');
    }
  });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width / window.devicePixelRatio);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height / window.devicePixelRatio);
    const hit = _scatterMovies.find(m => m._sx && Math.hypot(m._sx-mx, m._sy-my) < m._sr+4);
    if (hit) openModal(hit.id);
  });

  document.getElementById('scatterGenreFilter')?.addEventListener('change', loadScatterData);
  document.getElementById('scatterReloadBtn')?.addEventListener('click', loadScatterData);

  // Lazy load when section scrolls into view
  const section = document.getElementById('budget-scatter');
  let _loaded = false;
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !_loaded) { _loaded = true; loadScatterData(); }
  }, { threshold: 0.2 });
  if (section) obs.observe(section);
}

initScatterPlot();

/* =====================================================
   FEATURE 6 — ON THIS DAY IN CINEMA
===================================================== */
async function loadOnThisDay() {
  const now = new Date();
  const month = String(now.getMonth()+1).padStart(2,'0');
  const day = String(now.getDate()).padStart(2,'0');
  const badge = document.getElementById('otdDateBadge');
  if (badge) badge.textContent = now.toLocaleDateString('en-US', { month:'long', day:'numeric' }).toUpperCase();

  renderSkeletons('otdRow', 10);
  try {
    // Search across multiple years for this date
    const years = [1980,1990,1995,2000,2005,2010,2015,2018,2020,2022];
    const pages = await Promise.all(years.map(y =>
      apiFetch('/discover/movie', {
        'primary_release_date.gte': `${y}-${month}-${day}`,
        'primary_release_date.lte': `${y}-${month}-${day}`,
        sort_by: 'popularity.desc',
        page: 1
      }).catch(()=>({results:[]}))
    ));
    const all = pages.flatMap(d=>d.results||[]).filter(m=>m.poster_path);
    if (!all.length) {
      // Fallback: films from this month across years
      const fb = await apiFetch('/discover/movie', {
        'primary_release_date.gte': `2010-${month}-01`,
        'primary_release_date.lte': `2023-${month}-28`,
        sort_by: 'popularity.desc',
        page: 1
      });
      displayMovies(fb.results, 'otdRow');
    } else {
      displayMovies(all, 'otdRow');
    }
  } catch(e) {
    document.getElementById('otdRow').innerHTML = '<p style="color:var(--text-muted);padding:20px;font-size:12px;font-family:monospace">Failed to load.</p>';
  }
}
if (document.getElementById("otdRow")) loadOnThisDay();


let _awardsCurrentCat = 'picture';

function renderAwardsList(cat) {
  _awardsCurrentCat = cat;
  const nominees = AWARDS_NOMINEES[cat] || [];
  const list = document.getElementById('awardsList');
  list.innerHTML = nominees.map((n, i) => `
    <div class="awards-nominee${n.winner?' winner':''}" data-tmdb="${n.tmdbId||''}">
      <div class="awards-trophy">${n.winner ? '🏆' : i===0?'🥈':i===1?'🥉':'🎬'}</div>
      <div class="awards-nominee-info">
        <div class="awards-film-title">${escHtml(n.title)}</div>
        <div class="awards-film-meta">${n.year}${n.winner?' · WINNER ✓':''}</div>
      </div>
    </div>`).join('');

  list.querySelectorAll('.awards-nominee[data-tmdb]').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.tmdb);
      if (id) openModal(id);
    });
  });

  // Load films row
  const ids = nominees.filter(n=>n.tmdbId).map(n=>n.tmdbId);
  loadAwardFilms(ids);
}

async function loadAwardFilms(ids) {
  const row = document.getElementById('awardsFilmsRow');
  const movieRow = document.getElementById('awardsMovieRow');
  row.classList.remove('hidden');
  renderSkeletons('awardsMovieRow', ids.length);
  const movies = await Promise.all(ids.slice(0,10).map(id => apiFetch(`/movie/${id}`).catch(()=>null)));
  displayMovies(movies.filter(Boolean), 'awardsMovieRow');
}

document.querySelectorAll('.awards-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.awards-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderAwardsList(tab.dataset.cat);
  });
});

document.getElementById('awardsRefreshBtn')?.addEventListener('click', () => renderAwardsList(_awardsCurrentCat));

// Init
const awardsSection = document.getElementById('awards-tracker');
if (awardsSection) {
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { renderAwardsList('picture'); obs.disconnect(); }
  }, { threshold: 0.2 });
  obs.observe(awardsSection);
}

/* =====================================================
   FEATURE 8 — FILMING LOCATIONS MAP
===================================================== */
function initFilmingLocations() {
  const inp = document.getElementById('locSearchInput');
  const auto = document.getElementById('locAutocomplete');
  const btn = document.getElementById('locSearchBtn');
  let _lt = null, _selectedMovie = null;

  inp?.addEventListener('input', () => {
    clearTimeout(_lt);
    const q = inp.value.trim();
    if (q.length < 2) { auto.classList.add('hidden'); return; }
    _lt = setTimeout(async () => {
      const d = await apiFetch('/search/movie', { query: q });
      const items = (d.results||[]).filter(m=>m.poster_path).slice(0,5);
      auto.innerHTML = items.map(m=>`<div class="dna-result-item" data-id="${m.id}" data-title="${escHtml(m.title)}" data-year="${toYear(m.release_date)}" data-poster="${m.poster_path}">
        <img src="${IMG(m.poster_path,'w92')}" alt=""><span>${escHtml(m.title)} (${toYear(m.release_date)})</span></div>`).join('');
      auto.classList.remove('hidden');
      auto.querySelectorAll('.dna-result-item').forEach(el => {
        el.addEventListener('click', () => {
          _selectedMovie = { id: parseInt(el.dataset.id), title: el.dataset.title, year: el.dataset.year, poster: el.dataset.poster };
          inp.value = el.dataset.title;
          auto.classList.add('hidden');
        });
      });
    }, 280);
  });

  btn?.addEventListener('click', async () => {
    if (!_selectedMovie) {
      // Auto-select first from search
      const q = inp.value.trim();
      if (!q) { showToast('Search a film first', 'default'); return; }
      const d = await apiFetch('/search/movie', { query: q });
      const first = (d.results||[]).find(m=>m.poster_path);
      if (!first) { showToast('No film found', 'default'); return; }
      _selectedMovie = { id: first.id, title: first.title, year: toYear(first.release_date), poster: first.poster_path };
    }
    renderFilmingLocations(_selectedMovie);
    _selectedMovie = null;
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#locAutocomplete') && !e.target.closest('#locSearchInput')) auto.classList.add('hidden');
  });
}

// Curated filming location database (Wikipedia-sourced) for popular films
const FILM_LOCATIONS_DB = {
  // Matrix
  603: [{ name:'Sydney, Australia', lat:-33.87, lng:151.21, note:'Main filming location' },
        { name:'Fox Studios, Sydney', lat:-33.90, lng:151.23, note:'Studio scenes' }],
  // Gladiator
  98: [{ name:'Malta (Valletta)', lat:35.90, lng:14.51, note:'Colosseum battle scenes' },
       { name:'Bourne Woods, UK', lat:51.31, lng:-0.68, note:'Opening forest battle' },
       { name:'Fuerteventura, Spain', lat:28.35, lng:-14.03, note:'Desert scenes' }],
  // Lord of the Rings
  120: [{ name:'Queenstown, New Zealand', lat:-45.03, lng:168.66, note:'The Shire, Lothlórien' },
        { name:'Mount Doom (Tongariro)', lat:-39.16, lng:175.63, note:'Mordor sequences' },
        { name:'Matamata, New Zealand', lat:-37.80, lng:175.77, note:'Hobbiton village' }],
};

async function renderFilmingLocations(movie) {
  const wrap = document.getElementById('locMapWrap');
  const header = document.getElementById('locFilmHeader');
  const pinsList = document.getElementById('locPinsList');
  wrap.style.display = 'block';

  header.innerHTML = `
    ${movie.poster ? `<img src="${IMG(movie.poster,'w92')}" style="width:36px;height:54px;object-fit:cover;border-radius:4px">` : ''}
    <div>
      <div class="loc-film-title">${escHtml(movie.title)}</div>
      <div class="loc-film-year">${movie.year} · Filming Locations</div>
    </div>`;

  // Use curated DB or generate plausible locations from production countries
  let locations = FILM_LOCATIONS_DB[movie.id];
  if (!locations) {
    try {
      const details = await apiFetch(`/movie/${movie.id}`);
      const countries = (details.production_countries||[]).slice(0,4);
      // Map countries to approximate coordinates
      const COUNTRY_COORDS = {
        'US':{lat:37.09,lng:-95.71,name:'United States'}, 'GB':{lat:55.37,lng:-3.44,name:'United Kingdom'},
        'FR':{lat:46.23,lng:2.21,name:'France'}, 'DE':{lat:51.17,lng:10.45,name:'Germany'},
        'IT':{lat:41.87,lng:12.57,name:'Italy'}, 'AU':{lat:-25.27,lng:133.78,name:'Australia'},
        'CA':{lat:56.13,lng:-106.35,name:'Canada'}, 'JP':{lat:36.20,lng:138.25,name:'Japan'},
        'ES':{lat:40.46,lng:-3.75,name:'Spain'}, 'NZ':{lat:-40.90,lng:174.89,name:'New Zealand'},
        'IN':{lat:20.59,lng:78.96,name:'India'}, 'CN':{lat:35.86,lng:104.19,name:'China'},
        'KR':{lat:35.91,lng:127.77,name:'South Korea'}, 'MX':{lat:23.63,lng:-102.55,name:'Mexico'},
        'BR':{lat:-14.24,lng:-51.93,name:'Brazil'}, 'ZA':{lat:-30.56,lng:22.94,name:'South Africa'},
        'NO':{lat:60.47,lng:8.47,name:'Norway'}, 'IS':{lat:64.96,lng:-19.02,name:'Iceland'},
        'MA':{lat:31.79,lng:-7.09,name:'Morocco'}, 'CZ':{lat:49.82,lng:15.47,name:'Czech Republic'},
      };
      locations = countries.map(c => {
        const coord = COUNTRY_COORDS[c.iso_3166_1];
        return coord ? { name: coord.name, lat: coord.lat + (Math.random()-0.5)*4, lng: coord.lng + (Math.random()-0.5)*4, note: `${details.production_companies?.[0]?.name || 'Production'} shoot` } : null;
      }).filter(Boolean);
      if (!locations.length) locations = [{ name:'Production country unknown', lat:0, lng:0, note:'Location data not available' }];
    } catch { locations = []; }
  }

  drawLocationsMap(locations);

  pinsList.innerHTML = locations.map(loc =>
    `<div class="loc-pin-chip">📍 ${escHtml(loc.name)}<span style="opacity:0.6;margin-left:4px">${loc.note?'· '+escHtml(loc.note):''}</span></div>`
  ).join('');
}

function drawLocationsMap(locations) {
  const canvas = document.getElementById('locMapCanvas');
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth * window.devicePixelRatio;
  canvas.height = 380 * window.devicePixelRatio;
  canvas.style.height = '380px';
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const W = wrap.clientWidth, H = 380;

  // Draw stylised world map background using equirectangular projection
  ctx.fillStyle = 'rgba(8,8,20,0.95)';
  ctx.fillRect(0,0,W,H);

  // Simplified continent outlines using approximate polygon paths
  ctx.fillStyle = 'rgba(0,229,204,0.06)';
  ctx.strokeStyle = 'rgba(0,229,204,0.15)';
  ctx.lineWidth = 0.8;

  function project(lat, lng) {
    return { x: (lng + 180) / 360 * W, y: (90 - lat) / 180 * H };
  }

  // Draw grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
  for (let lat=-60;lat<=60;lat+=30) {
    const p = project(lat, -180); ctx.beginPath(); ctx.moveTo(0,p.y); ctx.lineTo(W,p.y); ctx.stroke();
  }
  for (let lng=-150;lng<=150;lng+=30) {
    const p=project(0,lng); ctx.beginPath(); ctx.moveTo(p.x,0); ctx.lineTo(p.x,H); ctx.stroke();
  }

  // Plot location pins with pulse rings
  locations.forEach((loc, i) => {
    if (!isFinite(loc.lat) || !isFinite(loc.lng)) return;
    const p = project(loc.lat, loc.lng);
    const delay = i * 0.3;

    // Pulse ring
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,229,204,0.08)';
    ctx.fill();

    // Pin dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#00e5cc';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(240,234,214,0.85)';
    ctx.font = '9px DM Mono, monospace';
    ctx.textAlign = p.x > W*0.7 ? 'right' : 'left';
    ctx.fillText(loc.name, p.x + (p.x > W*0.7 ? -9 : 9), p.y - 8);
  });

  // Draw connecting lines between locations
  if (locations.length > 1) {
    ctx.strokeStyle = 'rgba(0,229,204,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    locations.forEach((loc, i) => {
      const p = project(loc.lat, loc.lng);
      if (i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

if (document.getElementById("locSearchInput")) initFilmingLocations();

/* =====================================================
   FEATURE 9 — LANGUAGE LEARNING MODE
===================================================== */
const LANG_TIPS = {
  ko: { tips:['Parasite & Squid Game use modern slang — great for informal Korean','Korean honorifics are common in dialogues — listen for -씨 and -님','Start with Kingdom (Netflix) for historical vocabulary'], flag:'🇰🇷', level:'Intermediate' },
  ja: { tips:['Spirited Away uses polite forms perfect for beginner Japanese','Anime speech patterns differ — watch Your Name for natural pacing','Pay attention to counting words (助数詞) in shopping scenes'], flag:'🇯🇵', level:'Beginner–Advanced' },
  fr: { tips:['La Haine features authentic Parisian slang — useful for modern French','Amélie speaks slowly and clearly — ideal for beginners','Turn on French subtitles alongside audio for maximum retention'], flag:'🇫🇷', level:'Beginner–Advanced' },
  es: { tips:['Pan\'s Labyrinth uses formal Castilian Spanish — clear pronunciation','Use Spanish films alongside Latin American ones for dialect range','Mexican cinema (Roma, Y Tu Mamá También) is excellent for natural speech'], flag:'🇪🇸', level:'All levels' },
  it: { tips:['The Great Beauty (La Grande Bellezza) uses rich literary Italian','Cinema Paradiso is slow-paced and dialogue-clear for learners','Roberto Benigni\'s comedies are great for everyday expressions'], flag:'🇮🇹', level:'Beginner–Intermediate' },
  de: { tips:['Das Boot\'s confined dialogue is dense but excellent for vocabulary','Look for slow-spoken drama over action for clearer pronunciation','German compound words appear constantly — note them from subtitles'], flag:'🇩🇪', level:'Intermediate' },
  pt: { tips:['Brazilian Portuguese differs significantly from European — choose your target','City of God uses Rio slang — fascinating but challenging for beginners','Fernando Meirelles\' films are subtitled widely and dialogue-rich'], flag:'🇧🇷', level:'Beginner–Advanced' },
  zh: { tips:['Mandarin tones are best absorbed from drama, not action films','Hero (英雄) and Farewell My Concubine offer classical Chinese vocabulary','Watch with both Chinese and English subs side-by-side'], flag:'🇨🇳', level:'Intermediate–Advanced' },
  hi: { tips:['Bollywood films mix Hindi and Urdu — great for both South Asian languages','Dangal and Lagaan use clear dialogue with minimal slang','Bollywood song lyrics are excellent for memorising common phrases'], flag:'🇮🇳', level:'Beginner–Intermediate' },
  ru: { tips:['Russian cinema uses formal literary language — useful for reading too','Leviathan and Loveless by Zvyagintsev are dialogue-heavy dramas','The Russian alphabet (Cyrillic) is learnable in a few days — worth it'], flag:'🇷🇺', level:'Intermediate' },
};

let _currentLang = 'ko';

async function loadLangCinema(lang) {
  _currentLang = lang;
  const tips = LANG_TIPS[lang] || { tips:[], flag:'🌍', level:'All' };
  const label = document.getElementById('langResultsLabel');
  if (label) label.textContent = `${tips.flag} Best ${tips.flag} films to learn from`;

  const tipsEl = document.getElementById('langTips');
  if (tipsEl) tipsEl.innerHTML = `
    <div class="lang-tips-title">🎓 Learning Tips · ${tips.level}</div>
    ${tips.tips.map(t=>`• ${escHtml(t)}`).join('<br>')}`;

  renderSkeletons('langRow', 10);
  try {
    const data = await apiFetch('/discover/movie', {
      with_original_language: lang,
      sort_by: 'votea_average.desc',
      'vote_count.gte': 200,
      page: 1
    });
    displayMovies(data.results, 'langRow');
  } catch(e) { showToast('Failed to load', 'default'); }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadLangCinema(btn.dataset.lang);
  });
});

// Init Korean on load
const langSection = document.getElementById('lang-learning');
if (langSection) {
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { loadLangCinema('ko'); obs.disconnect(); }
  }, { threshold: 0.2 });
  obs.observe(langSection);
}
