// ============================================================
//  NovaBeats — app.js
//  Features: Search, Like, Share, Shuffle, Repeat, 3D, Player
// ============================================================
const API_BASE = "https://music-sona-backend.vercel.app/api";
const IMAGEKIT_PUBLIC_KEY   = "public_yjk4r/uBhZDs80qyPem5dWEsZ1s=";
const IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/slrdselkt";

// ============================================================
//  STATE
// ============================================================
let currentUser  = null;
let allMusics    = [];
let playlist     = [];
let currentIndex = -1;
let isPlaying    = false;
let selectedRole = "user";
let likedSongs   = {};          // { musicId: musicObject }
let isShuffle    = false;
let isRepeat     = false;
let shuffleOrder = [];
let searchFilter = "all";       // all | tracks | albums | artists
let activeFilter = "all";       // home filter chip
let currentShareTrack = null;

// ============================================================
//  PARTICLE BACKGROUND
// ============================================================
(function initParticles() {
  const canvas = document.getElementById("particles-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener("resize", resize);

  const COLORS = ["124,106,245","240,101,200","64,224,208","168,255,62","255,107,107"];

  for (let i = 0; i < 90; i++) particles.push(mkParticle());

  function mkParticle() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2 + 0.4,
      dx: (Math.random() - 0.5) * 0.45, dy: (Math.random() - 0.5) * 0.45,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.5 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.pulse += 0.018;
      const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${a})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    });
    // Connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(124,106,245,${0.07 * (1 - d/110)})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ============================================================
//  DOM REFS
// ============================================================
const authOverlay   = document.getElementById("auth-overlay");
const appEl         = document.getElementById("app");
const playerBar     = document.getElementById("player-bar");
const audioEl       = document.getElementById("audio-player");
const loginForm     = document.getElementById("login-form");
const registerForm  = document.getElementById("register-form");
const loginError    = document.getElementById("login-error");
const regError      = document.getElementById("reg-error");
const uploadError   = document.getElementById("upload-error");
const uploadSuccess = document.getElementById("upload-success");
const albumError    = document.getElementById("album-error");
const albumSuccess  = document.getElementById("album-success");

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================
let toastTimer = null;
function showToast(msg, type = "success") {
  const toast   = document.getElementById("toast");
  const toastMsg= document.getElementById("toast-msg");
  const icon    = toast.querySelector(".toast-icon");
  toastMsg.textContent = msg;
  toast.className = `toast show ${type}`;
  icon.className = type === "liked"
    ? "toast-icon fa-solid fa-heart"
    : type === "error"
    ? "toast-icon fa-solid fa-circle-xmark"
    : "toast-icon fa-solid fa-circle-check";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// ============================================================
//  GREETING
// ============================================================
function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const el = document.getElementById("greeting-text");
  if (el) el.textContent = g;
}

// ============================================================
//  AUTH TABS
// ============================================================
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tab.dataset.tab}-form`).classList.add("active");
    loginError.textContent = regError.textContent = "";
  });
});

// ============================================================
//  ROLE TOGGLE
// ============================================================
document.querySelectorAll(".role-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedRole = btn.dataset.role;
  });
});

// ============================================================
//  API HELPER
// ============================================================
async function api(method, endpoint, body = null, isForm = false) {
  try {
    const opts = {
      method, credentials: "include",
      headers: isForm ? {} : { "Content-Type": "application/json" },
    };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    const res = await fetch(API_BASE + endpoint, opts);
    const ct = res.headers.get("content-type");
    const data = ct && ct.includes("application/json") ? await res.json() : { message: await res.text() };
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error("API Error:", endpoint, err.message);
    return { ok: false, status: 0, data: { message: "Cannot reach the server. Please try again." } };
  }
}

// ============================================================
//  REGISTER
// ============================================================
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  regError.textContent = "";
  const username = document.getElementById("reg-username").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const btn = registerForm.querySelector("button[type=submit]");
  btn.disabled = true; btn.querySelector("span").textContent = "Creating...";
  const { ok, data } = await api("POST", "/auth/register", { username, email, password, role: selectedRole });
  btn.disabled = false; btn.querySelector("span").textContent = "Create Account";
  if (!ok) { regError.textContent = data.message || "Registration failed"; return; }
  currentUser = data.user;
  loadLikes();
  enterApp();
});

// ============================================================
//  LOGIN
// ============================================================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const identifier = document.getElementById("login-identifier").value.trim();
  const password   = document.getElementById("login-password").value;
  const isEmail    = identifier.includes("@");
  const body       = isEmail ? { email: identifier, password } : { username: identifier, password };
  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true; btn.querySelector("span").textContent = "Signing in...";
  const { ok, data } = await api("POST", "/auth/login", body);
  btn.disabled = false; btn.querySelector("span").textContent = "Sign In";
  if (!ok) { loginError.textContent = data.message || "Invalid credentials"; return; }
  currentUser = data.user;
  loadLikes();
  enterApp();
});

// ============================================================
//  LOGOUT
// ============================================================
document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("POST", "/auth/logout");
  currentUser = null; allMusics = []; playlist = []; currentIndex = -1;
  likedSongs = {};
  stopPlayer();
  appEl.classList.add("hidden");
  playerBar.classList.add("hidden");
  authOverlay.classList.add("active");
});

// ============================================================
//  ENTER APP
// ============================================================
function enterApp() {
  authOverlay.classList.remove("active");
  appEl.classList.remove("hidden");
  setGreeting();
  updateSidebarUser();
  setupArtistUI();
  loadMusics();
  showView("home");
}

function updateSidebarUser() {
  document.getElementById("sidebar-username").textContent = currentUser.username;
  document.getElementById("sidebar-role").textContent     = currentUser.role;
  document.getElementById("user-avatar-letter").textContent = currentUser.username[0].toUpperCase();
}

function setupArtistUI() {
  document.querySelectorAll(".artist-only").forEach(el => {
    el.classList.toggle("hidden", currentUser.role !== "artist");
  });
}

// ============================================================
//  VIEW NAVIGATION
// ============================================================
function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const view = document.getElementById(`view-${viewId}`);
  if (view) view.classList.add("active");
  const nav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (nav) nav.classList.add("active");
  if (viewId === "albums")       loadAlbums();
  if (viewId === "liked")        renderLikedSongs();
  if (viewId === "create-album") loadTrackChecklist();
  if (viewId === "search")       document.getElementById("search-input").focus();
}

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => { e.preventDefault(); showView(item.dataset.view); });
});
document.getElementById("back-to-albums").addEventListener("click", () => showView("albums"));

// ============================================================
//  FILTER CHIPS (home)
// ============================================================
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    renderMusicGrid();
  });
});

// ============================================================
//  LOAD MUSICS
// ============================================================
async function loadMusics() {
  const grid = document.getElementById("music-grid");
  grid.innerHTML = `<div class="skeleton-loader"></div>`.repeat(5);
  const { ok, data } = await api("GET", "/music");
  grid.innerHTML = "";
  if (!ok) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`;
    return;
  }
  allMusics = data.musics || [];
  playlist  = [...allMusics];
  // set featured banner
  if (allMusics.length) setFeatured(allMusics[0]);
  renderMusicGrid();
}

function renderMusicGrid() {
  const grid = document.getElementById("music-grid");
  grid.innerHTML = "";
  let toShow = [...allMusics];
  if (activeFilter === "recent") toShow = toShow.slice(-8).reverse();
  if (!toShow.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-music"></i><p>No tracks yet</p></div>`;
    return;
  }
  toShow.forEach((music, i) => {
    const card = createMusicCard(music, i);
    card.style.animationDelay = `${i * 0.045}s`;
    grid.appendChild(card);
  });
}

function setFeatured(music) {
  const title  = document.getElementById("featured-title");
  const artist = document.getElementById("featured-artist");
  const btn    = document.getElementById("featured-play-btn");
  if (!title) return;
  title.textContent  = music.title || "—";
  artist.textContent = music.artist?.username || "Unknown Artist";
  btn.onclick = () => {
    const idx = allMusics.findIndex(m => m._id === music._id);
    if (idx >= 0) playTrack(idx, allMusics);
  };
}

function createMusicCard(music, index) {
  const card = document.createElement("div");
  card.className = "music-card";
  card.dataset.id = music._id;
  const artistName = music.artist?.username || "Unknown Artist";
  const emojis = ["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻","🎼","🎤","🎧","💿"];
  const emoji  = emojis[Math.abs(hashStr(music._id)) % emojis.length];
  const isLiked = !!likedSongs[music._id];

  card.innerHTML = `
    <button class="card-share-btn" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
    <button class="card-like-btn ${isLiked ? "liked" : ""}" title="Like">
      <i class="fa-${isLiked ? "solid" : "regular"} fa-heart"></i>
    </button>
    <div class="music-thumb">
      <div class="music-thumb-bg"></div>
      <span style="font-size:2.5rem;position:relative;z-index:1">${emoji}</span>
      <div class="play-overlay">
        <div class="play-overlay-btn"><i class="fa-solid fa-play"></i></div>
      </div>
    </div>
    <div class="music-card-title">${escHtml(music.title)}</div>
    <div class="music-card-artist">${escHtml(artistName)}</div>
  `;

  // Play
  card.querySelector(".play-overlay-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    playlist = [...allMusics];
    playTrack(index, playlist);
  });
  card.addEventListener("click", () => {
    playlist = [...allMusics];
    playTrack(index, playlist);
  });

  // Like
  const likeBtn = card.querySelector(".card-like-btn");
  likeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleLike(music, likeBtn);
  });

  // Share
  const shareBtn = card.querySelector(".card-share-btn");
  shareBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openShareModal(music);
  });

  return card;
}

// ============================================================
//  LOAD ALBUMS
// ============================================================
async function loadAlbums() {
  const grid = document.getElementById("albums-grid");
  grid.innerHTML = `<div class="skeleton-loader"></div>`.repeat(3);
  const { ok, data } = await api("GET", "/music/albums");
  grid.innerHTML = "";
  if (!ok) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`;
    return;
  }
  const albums = data.albums || [];
  if (!albums.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-record-vinyl"></i><p>No albums yet</p></div>`;
    return;
  }
  albums.forEach((album, i) => {
    const card = createAlbumCard(album);
    card.style.animationDelay = `${i * 0.06}s`;
    grid.appendChild(card);
  });
}

function createAlbumCard(album) {
  const card = document.createElement("div");
  card.className = "album-card";
  const artistName = album.artist?.username || "Unknown";
  const emojis = ["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻"];
  const emoji  = emojis[Math.abs(hashStr(album._id)) % emojis.length];
  card.innerHTML = `
    <div class="album-art">${emoji}</div>
    <div class="album-card-title">${escHtml(album.title)}</div>
    <div class="album-card-artist">${escHtml(artistName)}</div>
  `;
  card.addEventListener("click", () => openAlbum(album._id));
  return card;
}

// ============================================================
//  OPEN ALBUM DETAIL
// ============================================================
async function openAlbum(albumId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-album-detail").classList.add("active");
  const content = document.getElementById("album-detail-content");
  content.innerHTML = `<div class="skeleton-loader" style="height:190px;max-width:540px"></div>`;
  const { ok, data } = await api("GET", `/music/albums/${albumId}`);
  if (!ok) { content.innerHTML = `<p class="muted">Failed to load album.</p>`; return; }
  const album      = data.album;
  const artistName = album.artist?.username || "Unknown";
  const tracks     = album.musics || [];
  const emojis     = ["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻"];
  const emoji      = emojis[Math.abs(hashStr(album._id)) % emojis.length];

  content.innerHTML = `
    <div class="album-detail-hero">
      <div class="album-detail-art">${emoji}</div>
      <div class="album-detail-info">
        <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted)">Album</p>
        <h2>${escHtml(album.title)}</h2>
        <p>${escHtml(artistName)} • ${tracks.length} track${tracks.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <button class="btn-primary" style="width:auto;padding:10px 24px;margin:0" id="album-play-all">
        <i class="fa-solid fa-play"></i> Play All
      </button>
    </div>
    <div class="track-list" id="album-track-list"></div>
  `;

  const albumPlaylist = tracks.map(t => ({ ...t, artist: album.artist }));

  document.getElementById("album-play-all").onclick = () => {
    if (albumPlaylist.length) { playlist = albumPlaylist; playTrack(0, playlist); }
  };

  const trackList = document.getElementById("album-track-list");
  if (!tracks.length) { trackList.innerHTML = `<p class="muted">No tracks in this album.</p>`; return; }

  tracks.forEach((track, i) => {
    const item = document.createElement("div");
    item.className = "track-item";
    item.innerHTML = `
      <span class="track-num">${i + 1}</span>
      <span class="track-item-title">${escHtml(track.title)}</span>
      <i class="fa-solid fa-play track-play-icon"></i>
    `;
    item.addEventListener("click", () => { playlist = albumPlaylist; playTrack(i, albumPlaylist); });
    trackList.appendChild(item);
  });
}

// ============================================================
//  SEARCH
// ============================================================
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
let searchDebounce = null;

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  searchClear.classList.toggle("hidden", !q);
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(q), 280);
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.add("hidden");
  document.getElementById("search-results").innerHTML = `
    <div class="search-empty"><div class="search-empty-icon">🎵</div><p>Start typing to search</p></div>`;
});

document.querySelectorAll(".s-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".s-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    searchFilter = tab.dataset.type;
    runSearch(searchInput.value.trim());
  });
});

async function runSearch(q) {
  const resultsEl = document.getElementById("search-results");
  if (!q) {
    resultsEl.innerHTML = `<div class="search-empty"><div class="search-empty-icon">🎵</div><p>Start typing to search</p></div>`;
    return;
  }

  resultsEl.innerHTML = `<div class="skeleton-loader" style="height:60px;margin-bottom:8px"></div>`.repeat(4);

  // Fetch fresh data
  const [mRes, aRes] = await Promise.all([
    api("GET", "/music"),
    api("GET", "/music/albums")
  ]);
  const musics = mRes.ok ? (mRes.data.musics || []) : [];
  const albums = aRes.ok ? (aRes.data.albums || []) : [];

  const ql = q.toLowerCase();

  const matchedTracks  = musics.filter(m => m.title.toLowerCase().includes(ql) || (m.artist?.username || "").toLowerCase().includes(ql));
  const matchedAlbums  = albums.filter(a => a.title.toLowerCase().includes(ql) || (a.artist?.username || "").toLowerCase().includes(ql));
  const artistNames    = [...new Set(musics.map(m => m.artist?.username).filter(Boolean))];
  const matchedArtists = artistNames.filter(a => a.toLowerCase().includes(ql));

  resultsEl.innerHTML = "";

  const total = (searchFilter === "all" ? matchedTracks.length + matchedAlbums.length + matchedArtists.length
    : searchFilter === "tracks" ? matchedTracks.length
    : searchFilter === "albums" ? matchedAlbums.length
    : matchedArtists.length);

  if (!total) {
    resultsEl.innerHTML = `<div class="search-empty"><div class="search-empty-icon">🔍</div><p>No results for "<strong>${escHtml(q)}</strong>"</p></div>`;
    return;
  }

  // Tracks section
  if ((searchFilter === "all" || searchFilter === "tracks") && matchedTracks.length) {
    const label = document.createElement("div");
    label.className = "search-section-title";
    label.textContent = "Tracks";
    resultsEl.appendChild(label);

    matchedTracks.forEach(track => {
      const idx = allMusics.findIndex(m => m._id === track._id);
      const row = document.createElement("div");
      row.className = "search-track-row";
      const emojis = ["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻","🎼","🎤"];
      const emoji  = emojis[Math.abs(hashStr(track._id)) % emojis.length];
      const isLiked = !!likedSongs[track._id];
      row.innerHTML = `
        <div class="str-thumb">${emoji}</div>
        <div class="str-info">
          <div class="str-title">${escHtml(track.title)}</div>
          <div class="str-sub">${escHtml(track.artist?.username || "Unknown")}</div>
        </div>
        <span class="str-badge">Track</span>
        <button class="card-like-btn ${isLiked ? "liked" : ""}" style="opacity:1;position:static;width:32px;height:32px" title="Like">
          <i class="fa-${isLiked ? "solid" : "regular"} fa-heart"></i>
        </button>
        <button class="card-share-btn" style="opacity:1;position:static;width:32px;height:32px" title="Share">
          <i class="fa-solid fa-share-nodes"></i>
        </button>
      `;
      row.querySelector(".str-title").parentElement.parentElement.addEventListener("click", (e) => {
        if (e.target.closest(".card-like-btn") || e.target.closest(".card-share-btn")) return;
        playlist = [...allMusics];
        playTrack(idx >= 0 ? idx : 0, playlist);
      });
      row.querySelector(".card-like-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLike(track, row.querySelector(".card-like-btn"));
      });
      row.querySelector(".card-share-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openShareModal(track);
      });
      resultsEl.appendChild(row);
    });
  }

  // Albums section
  if ((searchFilter === "all" || searchFilter === "albums") && matchedAlbums.length) {
    const label = document.createElement("div");
    label.className = "search-section-title";
    label.textContent = "Albums";
    resultsEl.appendChild(label);

    matchedAlbums.forEach(album => {
      const row = document.createElement("div");
      row.className = "search-track-row";
      const emojis = ["🎵","🎶","🎸","🎹","🥁","🎷"];
      const emoji  = emojis[Math.abs(hashStr(album._id)) % emojis.length];
      row.innerHTML = `
        <div class="str-thumb">${emoji}</div>
        <div class="str-info">
          <div class="str-title">${escHtml(album.title)}</div>
          <div class="str-sub">${escHtml(album.artist?.username || "Unknown")}</div>
        </div>
        <span class="str-badge">Album</span>
      `;
      row.addEventListener("click", () => openAlbum(album._id));
      resultsEl.appendChild(row);
    });
  }

  // Artists section
  if ((searchFilter === "all" || searchFilter === "artists") && matchedArtists.length) {
    const label = document.createElement("div");
    label.className = "search-section-title";
    label.textContent = "Artists";
    resultsEl.appendChild(label);

    matchedArtists.forEach(artistName => {
      const artistTracks = musics.filter(m => m.artist?.username === artistName);
      const row = document.createElement("div");
      row.className = "search-track-row";
      row.innerHTML = `
        <div class="str-thumb" style="background:linear-gradient(135deg,var(--accent3),var(--pink));color:white;font-size:1.3rem">
          ${artistName[0].toUpperCase()}
        </div>
        <div class="str-info">
          <div class="str-title">${escHtml(artistName)}</div>
          <div class="str-sub">${artistTracks.length} track${artistTracks.length !== 1 ? "s" : ""}</div>
        </div>
        <span class="str-badge">Artist</span>
      `;
      row.addEventListener("click", () => {
        // Play all artist tracks
        const artistPlaylist = artistTracks;
        if (artistPlaylist.length) { playlist = artistPlaylist; playTrack(0, playlist); showView("home"); }
      });
      resultsEl.appendChild(row);
    });
  }
}

// ============================================================
//  LIKES SYSTEM (local storage)
// ============================================================
function loadLikes() {
  try {
    const stored = localStorage.getItem(`novabeats_likes_${currentUser?.id}`);
    likedSongs = stored ? JSON.parse(stored) : {};
  } catch { likedSongs = {}; }
  updateLikedCount();
}

function saveLikes() {
  try {
    localStorage.setItem(`novabeats_likes_${currentUser?.id}`, JSON.stringify(likedSongs));
  } catch {}
  updateLikedCount();
}

function updateLikedCount() {
  const count = Object.keys(likedSongs).length;
  const badge = document.getElementById("liked-count");
  const text  = document.getElementById("liked-count-text");
  if (badge) badge.textContent = count;
  if (text)  text.textContent  = `${count} song${count !== 1 ? "s" : ""}`;
}

function toggleLike(music, btn) {
  const id = music._id;
  if (likedSongs[id]) {
    delete likedSongs[id];
    if (btn) {
      btn.classList.remove("liked");
      btn.innerHTML = `<i class="fa-regular fa-heart"></i>`;
    }
    showToast(`Removed from Liked Songs`, "success");
  } else {
    likedSongs[id] = music;
    if (btn) {
      btn.classList.add("liked");
      btn.innerHTML = `<i class="fa-solid fa-heart"></i>`;
    }
    showToast(`Added to Liked Songs ❤️`, "liked");
  }
  saveLikes();
  // sync player like btn
  if (currentIndex >= 0 && playlist[currentIndex]?._id === id) {
    syncPlayerLikeBtn(id);
  }
  // update liked view if open
  const likedView = document.getElementById("view-liked");
  if (likedView && likedView.classList.contains("active")) renderLikedSongs();
}

function syncPlayerLikeBtn(id) {
  const btn = document.getElementById("player-like-btn");
  if (!btn) return;
  const isLiked = !!likedSongs[id];
  btn.classList.toggle("liked", isLiked);
  btn.innerHTML = `<i class="fa-${isLiked ? "solid" : "regular"} fa-heart"></i>`;
}

document.getElementById("player-like-btn").addEventListener("click", () => {
  if (currentIndex < 0 || !playlist[currentIndex]) return;
  const music = playlist[currentIndex];
  toggleLike(music, document.getElementById("player-like-btn"));
  // sync card like btn
  document.querySelectorAll(`.music-card[data-id="${music._id}"] .card-like-btn`).forEach(b => {
    const isLiked = !!likedSongs[music._id];
    b.classList.toggle("liked", isLiked);
    b.innerHTML = `<i class="fa-${isLiked ? "solid" : "regular"} fa-heart"></i>`;
  });
});

// ============================================================
//  LIKED SONGS VIEW
// ============================================================
function renderLikedSongs() {
  const list  = document.getElementById("liked-list");
  const songs = Object.values(likedSongs);
  updateLikedCount();

  if (!songs.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-regular fa-heart"></i><p>Songs you like will appear here</p></div>`;
    return;
  }

  list.innerHTML = "";
  songs.forEach((music, i) => {
    const row = document.createElement("div");
    row.className = "liked-track-row";
    const emojis = ["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻"];
    const emoji  = emojis[Math.abs(hashStr(music._id)) % emojis.length];
    row.innerHTML = `
      <span class="ltr-num">${i + 1}</span>
      <div class="ltr-thumb">${emoji}</div>
      <div class="ltr-info">
        <div class="ltr-title">${escHtml(music.title)}</div>
        <div class="ltr-artist">${escHtml(music.artist?.username || "Unknown")}</div>
      </div>
      <button class="ltr-unlike" title="Remove from liked"><i class="fa-solid fa-heart"></i></button>
    `;
    row.addEventListener("click", (e) => {
      if (e.target.closest(".ltr-unlike")) return;
      playlist = songs;
      playTrack(i, songs);
    });
    row.querySelector(".ltr-unlike").addEventListener("click", () => {
      toggleLike(music, null);
      renderLikedSongs();
      // sync card button
      document.querySelectorAll(`.music-card[data-id="${music._id}"] .card-like-btn`).forEach(b => {
        b.classList.remove("liked");
        b.innerHTML = `<i class="fa-regular fa-heart"></i>`;
      });
    });
    list.appendChild(row);
  });
}

// ============================================================
//  SHARE MODAL
// ============================================================
function openShareModal(music) {
  currentShareTrack = music;
  document.getElementById("share-title").textContent  = music.title || "Unknown";
  document.getElementById("share-artist").textContent = music.artist?.username || "Unknown";
  const link = music.uri || window.location.href;
  document.getElementById("share-link-input").value = link;
  document.getElementById("share-modal").classList.remove("hidden");
}

document.getElementById("share-modal-close").addEventListener("click", () => {
  document.getElementById("share-modal").classList.add("hidden");
});
document.getElementById("share-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("share-modal")) document.getElementById("share-modal").classList.add("hidden");
});

document.getElementById("copy-link-btn").addEventListener("click", () => {
  const input = document.getElementById("share-link-input");
  navigator.clipboard.writeText(input.value).then(() => {
    showToast("Link copied to clipboard!");
  }).catch(() => {
    input.select(); document.execCommand("copy");
    showToast("Link copied!");
  });
});

document.getElementById("share-whatsapp").addEventListener("click", () => {
  if (!currentShareTrack) return;
  const text = `🎵 Listen to "${currentShareTrack.title}" on NovaBeats!\n${currentShareTrack.uri || window.location.href}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
});

document.getElementById("share-twitter").addEventListener("click", () => {
  if (!currentShareTrack) return;
  const text = `🎵 Listening to "${currentShareTrack.title}" on NovaBeats!`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(currentShareTrack.uri || window.location.href)}`, "_blank");
});

document.getElementById("share-player-btn").addEventListener("click", () => {
  if (currentIndex >= 0 && playlist[currentIndex]) openShareModal(playlist[currentIndex]);
});

// ============================================================
//  UPLOAD — Direct to ImageKit
// ============================================================
const fileDropZone = document.getElementById("file-drop-zone");
const fileInput    = document.getElementById("upload-file");
const fileLabel    = document.getElementById("file-label");

fileDropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => { if (fileInput.files[0]) fileLabel.textContent = fileInput.files[0].name; });
fileDropZone.addEventListener("dragover", (e) => { e.preventDefault(); fileDropZone.classList.add("drag-over"); });
fileDropZone.addEventListener("dragleave", () => fileDropZone.classList.remove("drag-over"));
fileDropZone.addEventListener("drop", (e) => {
  e.preventDefault(); fileDropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) { fileInput.files = e.dataTransfer.files; fileLabel.textContent = file.name; }
});

async function uploadToImageKit(file) {
  const { ok, data } = await api("GET", "/music/imagekit-auth");
  if (!ok) throw new Error("Failed to get upload auth");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", "music_" + Date.now());
  formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
  formData.append("signature", data.signature);
  formData.append("expire", data.expire);
  formData.append("token", data.token);
  formData.append("folder", "novabeats/music");
  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
  if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Upload failed"); }
  return (await res.json()).url;
}

document.getElementById("upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadError.textContent = ""; uploadSuccess.textContent = "";
  const title = document.getElementById("upload-title").value.trim();
  const file  = fileInput.files[0];
  if (!file)  { uploadError.textContent = "Please select an audio file."; return; }
  if (!title) { uploadError.textContent = "Please enter a track title."; return; }
  const btn = document.getElementById("upload-btn");
  btn.disabled = true; btn.querySelector("span").textContent = "Uploading...";
  try {
    const audioUrl = await uploadToImageKit(file);
    btn.querySelector("span").textContent = "Saving...";
    const { ok, data } = await api("POST", "/music/save-track", { title, uri: audioUrl });
    if (!ok) { uploadError.textContent = data.message || "Failed to save track"; return; }
    uploadSuccess.textContent = "Track uploaded! 🎉";
    showToast("Track uploaded successfully! 🎉");
    document.getElementById("upload-form").reset();
    fileLabel.textContent = "Drop your audio file here or click to browse";
    loadMusics();
  } catch (err) {
    uploadError.textContent = err.message || "Upload failed";
  } finally {
    btn.disabled = false; btn.querySelector("span").textContent = "Upload Track";
  }
});

// ============================================================
//  CREATE ALBUM
// ============================================================
async function loadTrackChecklist() {
  const list = document.getElementById("track-checklist");
  list.innerHTML = `<p class="muted">Loading tracks...</p>`;
  const { ok, data } = await api("GET", "/music");
  if (ok) allMusics = data.musics || [];
  list.innerHTML = "";
  if (!allMusics.length) {
    list.innerHTML = `<p class="muted">Upload some tracks first to create an album.</p>`;
    return;
  }
  allMusics.forEach(track => {
    const item = document.createElement("label");
    item.className = "track-check-item";
    item.innerHTML = `<input type="checkbox" value="${track._id}" /><span>${escHtml(track.title)}</span>`;
    list.appendChild(item);
  });
}

document.getElementById("album-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  albumError.textContent = ""; albumSuccess.textContent = "";
  const title   = document.getElementById("album-title").value.trim();
  const checked = [...document.querySelectorAll("#track-checklist input:checked")].map(i => i.value);
  if (!title)          { albumError.textContent = "Album title is required"; return; }
  if (!checked.length) { albumError.textContent = "Select at least one track"; return; }
  const btn = e.submitter;
  btn.disabled = true; btn.querySelector("span").textContent = "Creating...";
  const { ok, data } = await api("POST", "/music/album", { title, musics: checked });
  btn.disabled = false; btn.querySelector("span").textContent = "Create Album";
  if (!ok) { albumError.textContent = data.message || "Failed to create album"; return; }
  albumSuccess.textContent = "Album created! 🎉";
  showToast("Album created successfully! 🎉");
  document.getElementById("album-form").reset();
  document.querySelectorAll("#track-checklist input").forEach(i => i.checked = false);
});

// ============================================================
//  AUDIO PLAYER
// ============================================================
function playTrack(index, tracks) {
  if (!tracks || !tracks.length) return;
  if (isShuffle && shuffleOrder.length) {
    index = shuffleOrder[index % shuffleOrder.length];
  }
  currentIndex = index;
  playlist     = tracks;
  const track  = tracks[index];
  if (!track || !track.uri) return;
  audioEl.src    = track.uri;
  audioEl.volume = parseFloat(document.getElementById("volume-slider").value);
  audioEl.play().catch(err => console.warn("Playback:", err));
  isPlaying = true;
  updatePlayerUI(track);
  playerBar.classList.remove("hidden");
  updatePlayingCard();
  syncPlayerLikeBtn(track._id);
  const mini     = document.getElementById("now-playing-mini");
  const npmTitle = document.getElementById("npm-title");
  if (mini)     mini.classList.remove("hidden");
  if (npmTitle) npmTitle.textContent = track.title;
}

function updatePlayerUI(track) {
  document.getElementById("player-title").textContent  = track.title || "Unknown";
  document.getElementById("player-artist").textContent = track.artist?.username || "Unknown Artist";
  document.getElementById("play-pause-btn").innerHTML  = `<i class="fa-solid fa-pause"></i>`;
}

function updatePlayingCard() {
  document.querySelectorAll(".music-card").forEach(card => {
    const isCurrentPlaylist = playlist === allMusics;
    const isCurrent = card.dataset.id === playlist[currentIndex]?._id;
    card.classList.toggle("playing", isCurrent && isCurrentPlaylist);
  });
  document.querySelectorAll(".track-item").forEach((item, i) => {
    item.classList.toggle("playing", i === currentIndex);
  });
  document.querySelectorAll(".liked-track-row").forEach((row, i) => {
    row.classList.toggle("playing", i === currentIndex && playlist === Object.values(likedSongs));
  });
}

function stopPlayer() {
  audioEl.pause(); audioEl.src = ""; isPlaying = false;
  document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-play"></i>`;
  const mini = document.getElementById("now-playing-mini");
  if (mini) mini.classList.add("hidden");
}

// Play / Pause
document.getElementById("play-pause-btn").addEventListener("click", () => {
  if (!audioEl.src) return;
  if (isPlaying) {
    audioEl.pause(); isPlaying = false;
    document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-play"></i>`;
  } else {
    audioEl.play().catch(() => {}); isPlaying = true;
    document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-pause"></i>`;
  }
});

// Prev / Next
document.getElementById("prev-btn").addEventListener("click", () => {
  if (!playlist.length) return;
  const newIdx = isShuffle
    ? Math.floor(Math.random() * playlist.length)
    : (currentIndex - 1 + playlist.length) % playlist.length;
  playTrack(newIdx, playlist);
});

document.getElementById("next-btn").addEventListener("click", () => {
  if (!playlist.length) return;
  const newIdx = isShuffle
    ? Math.floor(Math.random() * playlist.length)
    : (currentIndex + 1) % playlist.length;
  playTrack(newIdx, playlist);
});

// Ended
audioEl.addEventListener("ended", () => {
  if (isRepeat) { audioEl.currentTime = 0; audioEl.play(); return; }
  const newIdx = isShuffle
    ? Math.floor(Math.random() * playlist.length)
    : (currentIndex + 1) % playlist.length;
  playTrack(newIdx, playlist);
});

// Shuffle
document.getElementById("shuffle-btn").addEventListener("click", () => {
  isShuffle = !isShuffle;
  document.getElementById("shuffle-btn").classList.toggle("active", isShuffle);
  showToast(isShuffle ? "Shuffle on 🔀" : "Shuffle off");
});

// Repeat
document.getElementById("repeat-btn").addEventListener("click", () => {
  isRepeat = !isRepeat;
  document.getElementById("repeat-btn").classList.toggle("active", isRepeat);
  showToast(isRepeat ? "Repeat on 🔁" : "Repeat off");
});

// Progress
audioEl.addEventListener("timeupdate", () => {
  if (!audioEl.duration) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  document.getElementById("progress-bar").value   = pct;
  document.getElementById("time-current").textContent = fmtTime(audioEl.currentTime);
  document.getElementById("time-total").textContent   = fmtTime(audioEl.duration);
  const fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = pct + "%";
});
document.getElementById("progress-bar").addEventListener("input", (e) => {
  if (!audioEl.duration) return;
  audioEl.currentTime = (e.target.value / 100) * audioEl.duration;
});
document.getElementById("volume-slider").addEventListener("input", (e) => {
  audioEl.volume = e.target.value;
});

// ============================================================
//  UTILITIES
// ============================================================
function fmtTime(s) {
  if (isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}
function escHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

// ============================================================
//  INIT
// ============================================================
setGreeting();