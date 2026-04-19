// ============================================================
//  SONA — Frontend App
// ============================================================
const API_BASE = "https://music-sona-backend.vercel.app/api";

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let allMusics = [];
let playlist = [];
let currentIndex = -1;
let isPlaying = false;
let selectedRole = "user";

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
//  GREETING
// ============================================================
function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const el = document.getElementById("greeting-text");
  if (el) el.textContent = greet;
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
    loginError.textContent = "";
    regError.textContent = "";
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
//  API HELPER — try/catch so buttons never freeze
// ============================================================
async function api(method, endpoint, body = null, isForm = false) {
  try {
    const opts = {
      method,
      credentials: "include",
      headers: isForm ? {} : { "Content-Type": "application/json" },
    };
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    const res = await fetch(API_BASE + endpoint, opts);

    const contentType = res.headers.get("content-type");
    let data = {};
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { message: text || `Server error (${res.status})` };
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error("API Error:", endpoint, err.message);
    return {
      ok: false,
      status: 0,
      data: { message: "Cannot reach the server. Please try again." },
    };
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
  btn.disabled = true; btn.textContent = "Creating...";

  const { ok, data } = await api("POST", "/auth/register", {
    username, email, password, role: selectedRole,
  });

  btn.disabled = false; btn.textContent = "Create Account";

  if (!ok) { regError.textContent = data.message || "Registration failed"; return; }
  currentUser = data.user;
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

  const isEmail = identifier.includes("@");
  const body = isEmail
    ? { email: identifier, password }
    : { username: identifier, password };

  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Signing in...";

  const { ok, data } = await api("POST", "/auth/login", body);

  btn.disabled = false; btn.textContent = "Sign In";

  if (!ok) { loginError.textContent = data.message || "Invalid credentials"; return; }
  currentUser = data.user;
  enterApp();
});

// ============================================================
//  LOGOUT
// ============================================================
document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("POST", "/auth/logout");
  currentUser = null;
  allMusics = [];
  playlist = [];
  currentIndex = -1;
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
  document.getElementById("sidebar-role").textContent = currentUser.role;
  document.getElementById("user-avatar-letter").textContent =
    currentUser.username[0].toUpperCase();
}

function setupArtistUI() {
  const artistOnly = document.querySelectorAll(".artist-only");
  if (currentUser.role === "artist") {
    artistOnly.forEach(el => el.classList.remove("hidden"));
  } else {
    artistOnly.forEach(el => el.classList.add("hidden"));
  }
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

  if (viewId === "albums") loadAlbums();
  if (viewId === "create-album") loadTrackChecklist();
}

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    showView(item.dataset.view);
  });
});

document.getElementById("back-to-albums").addEventListener("click", () => {
  showView("albums");
});

// ============================================================
//  LOAD MUSICS
// ============================================================
async function loadMusics() {
  const grid = document.getElementById("music-grid");
  grid.innerHTML = `
    <div class="skeleton-loader"></div>
    <div class="skeleton-loader"></div>
    <div class="skeleton-loader"></div>
    <div class="skeleton-loader"></div>
    <div class="skeleton-loader"></div>
  `;

  const { ok, data } = await api("GET", "/music");

  grid.innerHTML = "";
  if (!ok) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`;
    return;
  }

  allMusics = data.musics || [];
  playlist = [...allMusics];

  if (!allMusics.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-music"></i><p>No tracks yet. Upload some music!</p></div>`;
    return;
  }

  allMusics.forEach((music, i) => grid.appendChild(createMusicCard(music, i)));
}

function createMusicCard(music, index) {
  const card = document.createElement("div");
  card.className = "music-card";
  card.dataset.id = music._id;
  const artistName = music.artist?.username || "Unknown Artist";
  card.innerHTML = `
    <div class="music-thumb">
      <i class="fa-solid fa-music"></i>
      <div class="play-overlay"><i class="fa-solid fa-play"></i></div>
    </div>
    <div class="music-card-title">${escHtml(music.title)}</div>
    <div class="music-card-artist">${escHtml(artistName)}</div>
  `;
  card.addEventListener("click", () => playTrack(index, allMusics));
  return card;
}

// ============================================================
//  LOAD ALBUMS
// ============================================================
async function loadAlbums() {
  const grid = document.getElementById("albums-grid");
  grid.innerHTML = `
    <div class="skeleton-loader"></div>
    <div class="skeleton-loader"></div>
    <div class="skeleton-loader"></div>
  `;

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

  albums.forEach(album => grid.appendChild(createAlbumCard(album)));
}

function createAlbumCard(album) {
  const card = document.createElement("div");
  card.className = "album-card";
  const artistName = album.artist?.username || "Unknown";
  const emojis = ["🎵", "🎶", "🎸", "🎹", "🥁", "🎷", "🎺", "🎻"];
  const emoji = emojis[Math.abs(hashStr(album._id)) % emojis.length];
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
  content.innerHTML = `<div class="skeleton-loader" style="height:180px;max-width:520px"></div>`;

  const { ok, data } = await api("GET", `/music/albums/${albumId}`);
  if (!ok) { content.innerHTML = `<p class="muted">Failed to load album.</p>`; return; }

  const album = data.album;
  const artistName = album.artist?.username || "Unknown";
  const tracks = album.musics || [];
  const emojis = ["🎵", "🎶", "🎸", "🎹", "🥁", "🎷", "🎺", "🎻"];
  const emoji = emojis[Math.abs(hashStr(album._id)) % emojis.length];

  content.innerHTML = `
    <div class="album-detail-hero">
      <div class="album-detail-art">${emoji}</div>
      <div class="album-detail-info">
        <p class="section-label">Album</p>
        <h2>${escHtml(album.title)}</h2>
        <p>${escHtml(artistName)} • ${tracks.length} track${tracks.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
    <div class="section-label">Tracks</div>
    <div class="track-list" id="album-track-list"></div>
  `;

  const trackList = document.getElementById("album-track-list");
  if (!tracks.length) {
    trackList.innerHTML = `<p class="muted">No tracks in this album.</p>`;
    return;
  }

  const albumPlaylist = tracks.map(t => ({ ...t, artist: album.artist }));
  tracks.forEach((track, i) => {
    const item = document.createElement("div");
    item.className = "track-item";
    item.innerHTML = `
      <span class="track-num">${i + 1}</span>
      <span class="track-item-title">${escHtml(track.title)}</span>
      <i class="fa-solid fa-play track-play-icon"></i>
    `;
    item.addEventListener("click", () => playTrack(i, albumPlaylist));
    trackList.appendChild(item);
  });
}

// ============================================================
//  UPLOAD TRACK
// ============================================================
const fileDropZone = document.getElementById("file-drop-zone");
const fileInput    = document.getElementById("upload-file");
const fileLabel    = document.getElementById("file-label");

fileDropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) fileLabel.textContent = fileInput.files[0].name;
});
fileDropZone.addEventListener("dragover", (e) => {
  e.preventDefault(); fileDropZone.classList.add("drag-over");
});
fileDropZone.addEventListener("dragleave", () => fileDropZone.classList.remove("drag-over"));
fileDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) { fileInput.files = e.dataTransfer.files; fileLabel.textContent = file.name; }
});

document.getElementById("upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadError.textContent = ""; uploadSuccess.textContent = "";
  const title = document.getElementById("upload-title").value.trim();
  const file  = fileInput.files[0];
  if (!file) { uploadError.textContent = "Please select an audio file."; return; }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("music", file);

  const btn = document.getElementById("upload-btn");
  btn.disabled = true; btn.textContent = "Uploading...";

  const { ok, data } = await api("POST", "/music/upload", formData, true);

  btn.disabled = false; btn.textContent = "Upload Track";

  if (!ok) { uploadError.textContent = data.message || "Upload failed"; return; }
  uploadSuccess.textContent = "Track uploaded successfully! 🎉";
  document.getElementById("upload-form").reset();
  fileLabel.textContent = "Drop your audio file here or click to browse";
  loadMusics();
});

// ============================================================
//  CREATE ALBUM
// ============================================================
async function loadTrackChecklist() {
  const list = document.getElementById("track-checklist");
  list.innerHTML = `<p class="muted">Loading tracks...</p>`;

  // Always fetch fresh list
  const { ok, data } = await api("GET", "/music");
  if (ok) allMusics = data.musics || [];

  // Show ALL tracks (artist picks from them)
  list.innerHTML = "";
  if (!allMusics.length) {
    list.innerHTML = `<p class="muted">Upload some tracks first to create an album.</p>`;
    return;
  }

  allMusics.forEach(track => {
    const item = document.createElement("label");
    item.className = "track-check-item";
    item.innerHTML = `
      <input type="checkbox" value="${track._id}" />
      <span>${escHtml(track.title)}</span>
    `;
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
  btn.disabled = true; btn.textContent = "Creating...";

  const { ok, data } = await api("POST", "/music/album", { title, musics: checked });

  btn.disabled = false; btn.textContent = "Create Album";

  if (!ok) { albumError.textContent = data.message || "Failed to create album"; return; }
  albumSuccess.textContent = "Album created! 🎉";
  document.getElementById("album-form").reset();
  // Uncheck all boxes
  document.querySelectorAll("#track-checklist input").forEach(i => i.checked = false);
});

// ============================================================
//  AUDIO PLAYER
// ============================================================
function playTrack(index, tracks) {
  if (!tracks || !tracks.length) return;
  currentIndex = index;
  playlist = tracks;

  const track = tracks[index];
  if (!track || !track.uri) return;

  audioEl.src = track.uri;
  audioEl.volume = parseFloat(document.getElementById("volume-slider").value);
  audioEl.play().catch(err => console.warn("Playback error:", err));
  isPlaying = true;

  updatePlayerUI(track);
  playerBar.classList.remove("hidden");
  updatePlayingCard();
}

function updatePlayerUI(track) {
  document.getElementById("player-title").textContent  = track.title || "Unknown";
  document.getElementById("player-artist").textContent = track.artist?.username || "Unknown Artist";
  document.getElementById("play-pause-btn").innerHTML  = `<i class="fa-solid fa-pause"></i>`;
}

function updatePlayingCard() {
  document.querySelectorAll(".music-card").forEach((card, i) => {
    card.classList.toggle("playing", i === currentIndex && playlist === allMusics);
  });
  document.querySelectorAll(".track-item").forEach((item, i) => {
    item.classList.toggle("playing", i === currentIndex);
  });
}

function stopPlayer() {
  audioEl.pause();
  audioEl.src = "";
  isPlaying = false;
  document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-play"></i>`;
}

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

document.getElementById("prev-btn").addEventListener("click", () => {
  if (!playlist.length) return;
  playTrack((currentIndex - 1 + playlist.length) % playlist.length, playlist);
});

document.getElementById("next-btn").addEventListener("click", () => {
  if (!playlist.length) return;
  playTrack((currentIndex + 1) % playlist.length, playlist);
});

audioEl.addEventListener("ended", () => {
  playTrack((currentIndex + 1) % playlist.length, playlist);
});

audioEl.addEventListener("timeupdate", () => {
  if (!audioEl.duration) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  document.getElementById("progress-bar").value = pct;
  document.getElementById("time-current").textContent = fmtTime(audioEl.currentTime);
  document.getElementById("time-total").textContent   = fmtTime(audioEl.duration);
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
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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