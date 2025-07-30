
📁 Tree for: C:\projects\stream-guru\web
----------------------------------------
web
+-- scripts
|   +-- api.js
|   +-- chat.js
|   +-- main.js
|   +-- modal.js
|   +-- theme.js
|   L-- ui.js
+-- styles
|   +-- _card.css
|   +-- _chat.css
|   +-- _globals.css
|   +-- _header.css
|   +-- _modal.css
|   +-- _search.css
|   L-- main.css
+-- supabase
|   L-- .temp
|       +-- gotrue-version
|       +-- pooler-url
|       +-- postgres-version
|       L-- rest-version
+-- chat.html
+-- explore.html
+-- index.html
+-- match.html
L-- styles.css

📜 Listing scripts with extensions: .ts, .txt, .tsx, .js, .jsx, .py, .html, .json, .css, .sql, .toml, .cjs, .ps1
----------------------------------------

### chat.html

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chat – Stream Guru</title>
  <link rel="stylesheet" href="styles/main.css" />
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <header class="header">
    <div class="logo">StreamGuru</div>
    <nav class="nav">
      <a href="index.html" class="nav-item">Home</a>
      <a href="explore.html" class="nav-item">Explore</a>
      <a href="chat.html" class="nav-item active">Chat</a>
      <a href="match.html" class="nav-item">Match Mode</a>
    </nav>
    <select id="themeSelector" title="Choose a theme">
      <option value="">Sunset (default)</option>
      <option value="theme-ocean">Ocean</option>
      <option value="theme-forest">Forest</option>
      <option value="theme-night">Night</option>
    </select>
  </header>

  <main class="main">
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-message assistant">
          <div class="message-bubble">
            Hi! I'm StreamGuru. Ask me for a recommendation, like "funny comedies from the 90s" or "a space opera with a great soundtrack".
          </div>
        </div>
      </div>
      <form class="chat-input-form" id="chat-form">
        <input
          type="text"
          id="chat-input"
          placeholder="Ask for a recommendation..."
          autocomplete="off"
          required
        />
        <button type="submit" id="chat-submit-button">Send</button>
      </form>
    </div>
  </main>

  <footer class="footer">
    <p>© 2025 Stream Guru</p>
  </footer>

  <div id="movie-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <button class="modal-close-btn" id="modal-close-btn">×</button>
      <div class="modal-body">
        <div class="modal-top-section">
          <div class="modal-poster-container">
            <img id="modal-poster" src="" alt="Movie Poster">
          </div>
          <div class="modal-details">
            <img id="modal-logo" class="modal-logo" src="" alt="Movie Logo">
            <h2 id="modal-title"></h2>
            <div class="modal-meta" id="modal-meta">
              <span id="modal-release-date"></span>
              <span id="modal-runtime"></span>
            </div>
            <div class="modal-genres" id="modal-genres"></div>

            <!-- MODIFIED: Trailer button and video wrapper -->
            <div class="modal-video-actions">
              <button id="modal-trailer-btn" class="modal-action-btn hidden">
                Watch Trailer
              </button>
              <div id="modal-video-wrapper" class="video-wrapper hidden">
                <!-- The YouTube iframe will be injected here by JavaScript -->
              </div>
            </div>

            <p id="modal-synopsis"></p>
          </div>
        </div>
        <div class="modal-cast">
          <h3>Top Cast</h3>
          <div class="cast-list" id="modal-cast-list"></div>
        </div>
      </div>
    </div>
  </div>

  <script type="module" src="scripts/chat.js"></script>
</body>
</html>

### explore.html

<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Explore - Stream Guru</title><link rel="stylesheet" href="styles.css"><script src="script.js" defer></script></head><body><header class="header"><div class="logo">Stream<span class="accent">Guru</span></div><nav class="nav"><a href="index.html" class="nav-item">Home</a><a href="explore.html" class="nav-item active">Explore</a><a href="chat.html" class="nav-item">Chat</a><a href="match.html" class="nav-item">Match Mode</a><select id="themeSelector" title="Choose a theme"><option value="">Sunset (default)</option><option value="theme-ocean">Ocean</option><option value="theme-forest">Forest</option><option value="theme-night">Night</option></select></nav></header><main class="main"><div class="hero"><h1>Explore Page</h1><p style="opacity:0.7;">This page is under construction. Come back soon!</p></div></main><footer class="footer"><p>© 2025 Stream Guru</p></footer></body></html>

### index.html

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stream Guru</title>
  
  <link rel="stylesheet" href="styles/main.css" />

  <!-- Google Fonts link -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
<header class="header">
  <div class="logo">StreamGuru</div>

  <nav class="nav">
    <a href="index.html" class="nav-item active">Home</a>
    <a href="explore.html" class="nav-item">Explore</a>
    <a href="chat.html" class="nav-item">Chat</a>
    <a href="match.html" class="nav-item">Match Mode</a>
  </nav>

  <select id="themeSelector" title="Choose a theme">
    <option value="">Sunset (default)</option>
    <option value="theme-ocean">Ocean</option>
    <option value="theme-forest">Forest</option>
    <option value="theme-night">Night</option>
  </select>
</header>
  <main class="main">
    <section class="hero">
      <h1>Discover your next favorite movie</h1>
      <form class="search-form" id="search-form">
        <input
          type="text"
          id="search-input"
          name="q"
          placeholder="e.g., mind-bending sci-fi..."
          class="search-input"
        />
        <button type="submit" class="search-button">Search</button>
      </form>
    </section>
    <section class="results-section">
      <h2 id="results-heading">Loading...</h2>
      <div class="movie-grid" id="movie-grid">
        <p class="placeholder-text">Fetching the latest trending movies...</p>
      </div>
    </section>
  </main>
  <footer class="footer">
    <p>© 2025 Stream Guru</p>
  </footer>

  <div id="movie-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <button class="modal-close-btn" id="modal-close-btn">×</button>
      <div class="modal-body">
        
        <div class="modal-top-section">
          <div class="modal-poster-container">
            <img id="modal-poster" src="" alt="Movie Poster">
          </div>
          <div class="modal-details">
            <img id="modal-logo" class="modal-logo" src="" alt="Movie Logo">
            <h2 id="modal-title"></h2>
            <div class="modal-meta" id="modal-meta">
              <span id="modal-release-date"></span>
              <span id="modal-runtime"></span>
            </div>
            <div class="modal-genres" id="modal-genres"></div>
            
            <!-- MODIFIED: Trailer button and video wrapper -->
            <div class="modal-video-actions">
              <button id="modal-trailer-btn" class="modal-action-btn hidden">
                Watch Trailer
              </button>
              <div id="modal-video-wrapper" class="video-wrapper hidden">
                <!-- The YouTube iframe will be injected here by JavaScript -->
              </div>
            </div>

            <p id="modal-synopsis"></p>
          </div>
        </div>

        <div class="modal-cast">
          <h3>Top Cast</h3>
          <div class="cast-list" id="modal-cast-list"></div>
        </div>

      </div>
    </div>
  </div>

  <script type="module" src="scripts/main.js"></script>
  
</body>
</html>

### match.html

<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Match Mode - Stream Guru</title><link rel="stylesheet" href="styles.css"><script src="script.js" defer></script></head><body><header class="header"><div class="logo">Stream<span class="accent">Guru</span></div><nav class="nav"><a href="index.html" class="nav-item">Home</a><a href="explore.html" class="nav-item">Explore</a><a href="chat.html" class="nav-item">Chat</a><a href="match.html" class="nav-item active">Match Mode</a><select id="themeSelector" title="Choose a theme"><option value="">Sunset (default)</option><option value="theme-ocean">Ocean</option><option value="theme-forest">Forest</option><option value="theme-night">Night</option></select></nav></header><main class="main"><div class="hero"><h1>Match Mode</h1><p style="opacity:0.7;">This page is under construction. Come back soon!</p></div></main><footer class="footer"><p>© 2025 Stream Guru</p></footer></body></html>

### api.js

// web/scripts/api.js

const FUNCTIONS_BASE = 'https://gfbafuojtjtnbtfdhiqo.functions.supabase.co';

/**
 * Fetches only the AI's witty response and parsed filters.
 * @param {string} message - The user's search query.
 * @returns {Promise<{ai_message: string, filters: object}>}
 */
export async function fetchAiResponse(message) {
  const response = await fetch(`${FUNCTIONS_BASE}/get-ai-response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error('Failed to get AI response.');
  return await response.json();
}

/**
 * Fetches media recommendations based on a message and pre-parsed filters.
 * @param {string} message - The user's original query.
 * @param {object} filters - The filters parsed by the AI.
 * @returns {Promise<Array>}
 */
export async function fetchMediaMatches(message, filters) {
  const response = await fetch(`${FUNCTIONS_BASE}/get-recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, filters }),
  });
  if (!response.ok) throw new Error('Failed to fetch recommendations.');
  const { recommendations } = await response.json();
  return recommendations;
}

// --- Other API functions remain the same ---

export async function fetchTrending() {
  const response = await fetch(`${FUNCTIONS_BASE}/trending`);
  if (!response.ok) throw new Error('Could not load trending titles.');
  const { trending } = await response.json();
  return trending;
}

export async function fetchMediaDetails(tmdb_id) {
  const response = await fetch(`${FUNCTIONS_BASE}/get-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tmdb_id }),
  });
  if (!response.ok) throw new Error('Could not load media details.');
  const { details } = await response.json();
  return details;
}

### chat.js

// web/scripts/chat.js

import { initTheme } from './theme.js';
import { fetchAiResponse, fetchMediaMatches } from './api.js'; // Use new functions
import { initModal } from './modal.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const submitButton = document.getElementById('chat-submit-button');
  
  initModal(chatMessages);

  function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.innerHTML = text;
    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
  }

  function formatRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return "I couldn't find any matches for that. Try asking for something else!";
    }
    let html = '<div class="recommendation-grid">';
    recommendations.forEach(rec => {
      if (!rec.poster_path) return;
      html += `<div class="rec-card" data-tmdb-id="${rec.tmdb_id}"><img src="${rec.poster_path}" alt="${rec.title}" class="rec-card-poster"><div class="rec-card-overlay"><p class="rec-card-title">${rec.title}</p></div></div>`;
    });
    html += '</div>';
    return html;
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    chatInput.value = '';
    chatInput.disabled = true;
    submitButton.disabled = true;
    appendMessage(userMessage, 'user');

    const thinkingBubble = appendMessage('Thinking...', 'assistant');
    thinkingBubble.classList.add('thinking');

    try {
      // --- NEW TWO-STEP LOGIC ---

      // Step 1: Get the fast AI response
      const { ai_message, filters } = await fetchAiResponse(userMessage);
      
      // Update the UI with the witty response immediately
      thinkingBubble.querySelector('.message-bubble').textContent = ai_message.trim() || "On it...";
      thinkingBubble.classList.remove('thinking');
      
      // Step 2: Now get the slower recommendations
      const searchBubble = appendMessage('Searching for matches...', 'assistant');
      searchBubble.classList.add('thinking');

      const recommendations = await fetchMediaMatches(userMessage, filters);
      const formattedHtml = formatRecommendations(recommendations);

      // Update the second bubble with the final results
      searchBubble.querySelector('.message-bubble').innerHTML = formattedHtml;
      searchBubble.classList.remove('thinking');

    } catch (error) {
      console.error("Chat error:", error);
      thinkingBubble.querySelector('.message-bubble').textContent = "Sorry, I ran into an error. Please try again.";
      thinkingBubble.classList.remove('thinking');
    } finally {
      chatInput.disabled = false;
      submitButton.disabled = false;
      chatInput.focus();
    }
  }

  if (chatForm) {
    chatForm.addEventListener('submit', handleChatSubmit);
  }
});

### main.js

// web/scripts/main.js

import { initTheme } from './theme.js';
import { fetchTrending, fetchAiResponse, fetchMediaMatches, fetchMediaDetails } from './api.js';
import { displayMovies, displayError, displayLoading } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // --- Get main page elements ---
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchButton = document.querySelector('.search-button');
  const movieGrid = document.getElementById('movie-grid');

  // --- Get all modal elements ---
  const modal = document.getElementById('movie-modal');
  const modalContent = modal.querySelector('.modal-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalPoster = document.getElementById('modal-poster');
  const modalLogo = document.getElementById('modal-logo');
  const modalTitle = document.getElementById('modal-title');
  const modalReleaseDate = document.getElementById('modal-release-date');
  const modalRuntime = document.getElementById('modal-runtime');
  const modalGenres = document.getElementById('modal-genres');
  const modalSynopsis = document.getElementById('modal-synopsis');
  const modalCastList = document.getElementById('modal-cast-list');
  const modalTrailerBtn = document.getElementById('modal-trailer-btn');
  const modalVideoWrapper = document.getElementById('modal-video-wrapper');
  
  // --- FIXED: The missing variable declarations are now here ---
  const modalWatchProviders = document.getElementById('modal-watch-providers');
  const modalProviderList = document.getElementById('modal-provider-list');
  
  let currentTrailerKey = null;

  async function handleSearch(event) {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    searchInput.disabled = true;
    searchButton.disabled = true;
    searchButton.textContent = 'Searching...';
    displayLoading(query);

    try {
      const { filters } = await fetchAiResponse(query);
      const recommendations = await fetchMediaMatches(query, filters);
      displayMovies(recommendations, `Recommendations for "${query}"`);
    } catch (error) {
      displayError(error.message);
    } finally {
      searchInput.disabled = false;
      searchButton.disabled = false;
      searchButton.textContent = 'Search';
    }
  }

  async function loadInitialPage() {
    displayLoading();
    try {
      const trendingMovies = await fetchTrending();
      displayMovies(trendingMovies, 'Trending Now');
    } catch (error) {
      displayError(error.message);
    }
  }

  function populateModal(details) {
    modalContent.style.backgroundImage = details.backdrop_path ? `url(${details.backdrop_path})` : '';
    modalPoster.src = details.poster_path;

    if (details.logo_path) {
      modalLogo.src = details.logo_path;
      modalLogo.style.display = 'block';
    } else {
      modalLogo.style.display = 'none';
    }

    modalTitle.textContent = details.title;
    modalSynopsis.textContent = details.synopsis;
    const releaseYear = details.release_date ? new Date(details.release_date).getFullYear() : 'N/A';
    modalReleaseDate.textContent = `Released: ${releaseYear}`;
    modalRuntime.textContent = details.runtime ? `Runtime: ${details.runtime} min` : '';

    modalGenres.innerHTML = '';
    details.genres.forEach(genreName => {
        const genreTag = document.createElement('span');
        genreTag.className = 'genre-tag';
        genreTag.textContent = genreName;
        modalGenres.appendChild(genreTag);
    });

    if (details.trailer_key) {
      currentTrailerKey = details.trailer_key;
      modalTrailerBtn.classList.remove('hidden');
    } else {
      currentTrailerKey = null;
      modalTrailerBtn.classList.add('hidden');
    }

    modalCastList.innerHTML = '';
    if (details.top_cast && details.top_cast.length > 0) {
        details.top_cast.forEach(actor => {
            const castMemberDiv = document.createElement('div');
            castMemberDiv.className = 'cast-member';
            castMemberDiv.innerHTML = `<img src="${actor.profile_path || 'https://placehold.co/185x278?text=No+Image'}" alt="${actor.name}" class="cast-member-img"><p class="cast-member-name">${actor.name}</p><p class="cast-member-char">${actor.character}</p>`;
            modalCastList.appendChild(castMemberDiv);
        });
    }

    modalProviderList.innerHTML = '';
    const providers = details.watch_providers;
    if (providers && providers.flatrate && providers.flatrate.length > 0) {
      modalWatchProviders.classList.remove('hidden');
      
      providers.flatrate.forEach(provider => {
        const providerLink = document.createElement('a');
        providerLink.href = providers.link;
        providerLink.target = '_blank';
        providerLink.rel = 'noopener noreferrer';
        providerLink.className = 'provider-item';

        const providerLogo = document.createElement('img');
        providerLogo.src = `https://image.tmdb.org/t/p/w92${provider.logo_path}`;
        providerLogo.alt = provider.provider_name;
        providerLogo.title = provider.provider_name;
        providerLogo.className = 'provider-logo';

        providerLink.appendChild(providerLogo);
        modalProviderList.appendChild(providerLink);
      });
    } else {
      modalWatchProviders.classList.add('hidden');
    }
  }

  function handleWatchTrailer() {
    if (!currentTrailerKey) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${currentTrailerKey}?autoplay=1&rel=0&showinfo=0&iv_load_policy=3`;
    iframe.title = "YouTube video player";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    modalVideoWrapper.innerHTML = '';
    modalVideoWrapper.appendChild(iframe);
    modalTrailerBtn.classList.add('hidden');
    modalVideoWrapper.classList.remove('hidden');
  }

  async function handleCardClick(event) {
    const clickedCard = event.target.closest('.movie-card');
    if (!clickedCard) return;
    const tmdbId = parseInt(clickedCard.dataset.tmdbId, 10);
    
    modal.classList.remove('hidden');
    modalContent.style.backgroundImage = '';
    modalTitle.textContent = 'Loading...';
    modalPoster.src = ''; 
    modalSynopsis.textContent = '';
    modalGenres.innerHTML = '';
    modalCastList.innerHTML = '';
    modalReleaseDate.textContent = '';
    modalRuntime.textContent = '';
    modalLogo.style.display = 'none';
    modalTrailerBtn.classList.add('hidden');
    modalVideoWrapper.classList.add('hidden');
    modalVideoWrapper.innerHTML = '';
    modalWatchProviders.classList.add('hidden');
    
    try {
      const details = await fetchMediaDetails(tmdbId);
      populateModal(details);
    } catch (error) {
      console.error("Error fetching details:", error);
      modalTitle.textContent = 'Error';
      modalSynopsis.textContent = 'Could not load movie details. Please try again later.';
    }
  }

  function closeModal() {
    modal.classList.add('hidden');
    modalVideoWrapper.innerHTML = '';
    modalVideoWrapper.classList.add('hidden');
    currentTrailerKey = null;
  }

  if (searchForm) {
    searchForm.addEventListener('submit', handleSearch);
  }
  if (movieGrid) {
    movieGrid.addEventListener('click', handleCardClick);
  }
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }
  if (modalTrailerBtn) {
    modalTrailerBtn.addEventListener('click', handleWatchTrailer);
  }

  loadInitialPage();
});

### modal.js

// web/scripts/modal.js

import { fetchMediaDetails } from './api.js';

let modal, modalContent, modalCloseBtn, modalPoster, modalLogo, modalTitle;
let modalReleaseDate, modalRuntime, modalGenres, modalSynopsis, modalCastList;
let modalTrailerBtn, modalVideoWrapper;

let currentTrailerKey = null;

function populateModal(details) {
  modalContent.style.backgroundImage = details.backdrop_path ? `url(${details.backdrop_path})` : '';
  modalPoster.src = details.poster_path;
  details.logo_path ? (modalLogo.src = details.logo_path, modalLogo.style.display = 'block') : modalLogo.style.display = 'none';
  modalTitle.textContent = details.title;
  modalSynopsis.textContent = details.synopsis;
  const releaseYear = details.release_date ? new Date(details.release_date).getFullYear() : 'N/A';
  modalReleaseDate.textContent = `Released: ${releaseYear}`;
  modalRuntime.textContent = details.runtime ? `Runtime: ${details.runtime} min` : '';

  modalGenres.innerHTML = '';
  details.genres.forEach(genreName => {
      const genreTag = document.createElement('span');
      genreTag.className = 'genre-tag';
      genreTag.textContent = genreName;
      modalGenres.appendChild(genreTag);
  });

  if (details.trailer_key) {
    currentTrailerKey = details.trailer_key;
    modalTrailerBtn.classList.remove('hidden');
  } else {
    currentTrailerKey = null;
    modalTrailerBtn.classList.add('hidden');
  }

  modalCastList.innerHTML = '';
  if (details.top_cast?.length > 0) {
      details.top_cast.forEach(actor => {
          const castMemberDiv = document.createElement('div');
          castMemberDiv.className = 'cast-member';
          castMemberDiv.innerHTML = `
              <img src="${actor.profile_path || 'https://placehold.co/185x278?text=No+Image'}" alt="${actor.name}" class="cast-member-img">
              <p class="cast-member-name">${actor.name}</p>
              <p class="cast-member-char">${actor.character}</p>
          `;
          modalCastList.appendChild(castMemberDiv);
      });
  }
}

function handleWatchTrailer() {
  if (!currentTrailerKey) return;
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${currentTrailerKey}?autoplay=1&rel=0&showinfo=0&iv_load_policy=3`;
  iframe.title = "YouTube video player";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.allowFullscreen = true;
  modalVideoWrapper.innerHTML = '';
  modalVideoWrapper.appendChild(iframe);
  modalTrailerBtn.classList.add('hidden');
  modalVideoWrapper.classList.remove('hidden');
}

async function openModal(tmdbId) {
  modal.classList.remove('hidden');
  modalContent.style.backgroundImage = '';
  modalTitle.textContent = 'Loading...';
  modalPoster.src = ''; 
  modalSynopsis.textContent = '';
  modalGenres.innerHTML = '';
  modalCastList.innerHTML = '';
  modalReleaseDate.textContent = '';
  modalRuntime.textContent = '';
  modalLogo.style.display = 'none';
  
  modalTrailerBtn.classList.add('hidden');
  modalVideoWrapper.classList.add('hidden');
  modalVideoWrapper.innerHTML = '';

  try {
    const details = await fetchMediaDetails(tmdbId);
    populateModal(details);
  } catch (error) {
    console.error("Error fetching details:", error);
    modalTitle.textContent = 'Error';
    modalSynopsis.textContent = 'Could not load movie details. Please try again later.';
  }
}

function closeModal() {
  modal.classList.add('hidden');
  
  modalVideoWrapper.innerHTML = '';
  modalVideoWrapper.classList.add('hidden');
  currentTrailerKey = null;
}

export function initModal(container) {
  modal = document.getElementById('movie-modal');
  modalContent = modal.querySelector('.modal-content');
  modalCloseBtn = document.getElementById('modal-close-btn');
  modalPoster = document.getElementById('modal-poster');
  modalLogo = document.getElementById('modal-logo');
  modalTitle = document.getElementById('modal-title');
  modalReleaseDate = document.getElementById('modal-release-date');
  modalRuntime = document.getElementById('modal-runtime');
  modalGenres = document.getElementById('modal-genres');
  modalSynopsis = document.getElementById('modal-synopsis');
  modalCastList = document.getElementById('modal-cast-list');
  
  modalTrailerBtn = document.getElementById('modal-trailer-btn');
  modalVideoWrapper = document.getElementById('modal-video-wrapper');
  
  if (!container || !modal) return;

  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-tmdb-id]');
    if (card) {
      const tmdbId = parseInt(card.dataset.tmdbId, 10);
      openModal(tmdbId);
    }
  });

  modalTrailerBtn.addEventListener('click', handleWatchTrailer);
  
  modalCloseBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
}

### theme.js

// web/scripts/theme.js

export function initTheme() {
  const themeSelector = document.getElementById('themeSelector');
  if (!themeSelector) return;

  const applyTheme = (theme) => {
    document.body.className = theme;
    localStorage.setItem('streamGuruTheme', theme);
    themeSelector.value = theme;
  };

  const savedTheme = localStorage.getItem('streamGuruTheme') || '';
  applyTheme(savedTheme);

  themeSelector.addEventListener('change', () => applyTheme(themeSelector.value));
}

### ui.js

// web/scripts/ui.js

const TMDB_BASE_URL = 'https://www.themoviedb.org/';

// Get DOM elements once
const movieGrid = document.getElementById('movie-grid');
const resultsHeading = document.getElementById('results-heading');

/**
 * Preloads the high-resolution poster and backdrop images for the modal view
 * to ensure they are cached by the browser for a faster user experience.
 * @param {Array} movies - The array of movie/show objects.
 */
function preloadModalImages(movies) {
  movies.forEach(movie => {
    // Preload the high-res poster for the modal
    if (movie.poster_path) {
      const highResPosterUrl = movie.poster_path.replace('w500', 'w780');
      const posterImg = new Image();
      posterImg.src = highResPosterUrl;
    }
    // Preload the backdrop image
    if (movie.backdrop_path) {
      const backdropImg = new Image();
      backdropImg.src = movie.backdrop_path;
    }
  });
}

/**
 * Renders a list of movies to the grid.
 * @param {Array} movies - The array of movie/show objects.
 * @param {string} heading - The text to display in the H2 heading.
 */
export function displayMovies(movies, heading) {
  resultsHeading.textContent = heading;
  movieGrid.innerHTML = ''; // Clear previous results

  if (!movies || movies.length === 0) {
    movieGrid.innerHTML = '<p class="placeholder-text">No results found. Try a different search!</p>';
    return;
  }

  movies.forEach(rec => {
    if (!rec.poster_path) return;

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.tmdbId = rec.tmdb_id; 

    const scoreBadge = rec.score ? `<div class="score-badge">${(rec.score * 100).toFixed(0)}%</div>` : '';

    card.innerHTML = `
        <img src="${rec.poster_path}" alt="Poster for ${rec.title}" class="card-poster">
        <div class="card-overlay">
            <p class="card-title">${rec.title}</p>
            ${scoreBadge}
        </div>
    `;
    movieGrid.appendChild(card);
  });

  // --- NEW: Kick off the preloading in the background ---
  preloadModalImages(movies);
}

/**
 * Displays an error message in the results area.
 * @param {string} message - The error message to display.
 */
export function displayError(message) {
  resultsHeading.textContent = 'Error';
  movieGrid.innerHTML = `<p class="error-text">${message}</p>`;
}

/**
 * Displays a loading state in the results area.
 * @param {string} query - The search query that is being fetched.
 */
export function displayLoading(query = '') {
  const message = query 
    ? `Thinking about "${query}"...` 
    : 'Loading...';
  resultsHeading.textContent = message;
  movieGrid.innerHTML = '<p class="placeholder-text">Fetching the latest titles...</p>';
}

### _card.css

/* web/styles/_card.css */

.results-section h2 {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--navy);
  margin-bottom: 1.5rem;
  padding-left: 1rem;
}

.movie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.5rem;
}

.placeholder-text, .error-text {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text);
  opacity: 0.7;
  padding-top: 2rem;
}

.error-text {
  color: var(--burgundy);
  font-weight: 600;
}

/* --- Previous Card Styles (Restored) --- */

/* This is the container that gets clicked */
.movie-card {
  display: block;
  position: relative; 
  border-radius: var(--card-radius);
  overflow: hidden; 
  text-decoration: none;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: transform 0.2s ease-in-out;
  cursor: pointer; /* Add pointer to show it's clickable */
}

.movie-card:hover {
  transform: translateY(-5px);
}

.card-poster {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* This is the overlay that holds the title and score */
.card-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 10%, rgba(0,0,0,0.5) 50%, transparent);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.5rem;
}

.card-title {
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
  flex-grow: 1;
}

.score-badge {
  background: var(--burgundy);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

### _chat.css

/* web/styles/_chat.css */

.chat-container {
  max-width: 800px;
  margin: 2rem auto;
  border: 1px solid var(--text);
  border-radius: var(--card-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* Set a height that works well on most screens */
  height: 70vh; 
}

.chat-messages {
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-message {
  display: flex;
  max-width: 75%;
}

.chat-message.user {
  align-self: flex-end;
}

.chat-message.assistant {
  align-self: flex-start;
}

.message-bubble {
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  line-height: 1.5;
}

/* User's message style */
.chat-message.user .message-bubble {
  background-color: var(--gold);
  color: var(--navy);
  border-bottom-right-radius: 0.25rem;
}

/* Assistant's message style */
.chat-message.assistant .message-bubble {
  background-color: var(--bg);
  border: 1px solid var(--text);
  border-bottom-left-radius: 0.25rem;
}

/* Thinking bubble for loading state */
.chat-message.assistant.thinking .message-bubble {
  color: var(--text);
  opacity: 0.7;
  font-style: italic;
}

.chat-input-form {
  display: flex;
  border-top: 1px solid var(--text);
}

.chat-input-form input {
  flex-grow: 1;
  border: none;
  background: var(--bg);
  color: var(--text);
  padding: 1.25rem;
  font-size: 1rem;
}
.chat-input-form input:focus {
  outline: none;
}

.chat-input-form button {
  padding: 0 2rem;
  border: none;
  background: var(--gold);
  color: var(--navy);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .2s, color .2s;
}

.chat-input-form button:hover {
    background: var(--burgundy);
    color: var(--bg);
}
.chat-input-form button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Let's make the movie recommendations look good */
.recommendation-list {
    margin-top: 0.5rem;
    padding-left: 0;
    list-style-type: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}
.recommendation-list li a {
    display: block;
    font-weight: 600;
    color: inherit;
    text-decoration: none;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
}
.theme-night .recommendation-list li a {
    color: var(--navy); /* Make links readable in night mode */
}
.recommendation-list li a:hover {
    background-color: rgba(0,0,0,0.1);
}

.recommendation-grid {
  display: flex;
  gap: 1rem;
  overflow-x: auto; /* This enables horizontal scrolling */
  padding: 0.5rem 0.25rem 1rem; /* Add some padding for the scrollbar */
  /* Hide scrollbar for a cleaner look, but still allow scrolling */
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.recommendation-grid::-webkit-scrollbar {
  display: none; /* Chrome, Safari, and Opera */
}

/* Individual recommendation card */
.rec-card {
  /* Set a fixed width so the cards line up horizontally */
  flex: 0 0 140px; 
  width: 140px;
  text-decoration: none;
  color: #fff;
  border-radius: var(--card-radius);
  overflow: hidden;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}
.rec-card:hover {
  transform: translateY(-4px);
}

.rec-card-poster {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rec-card-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 20%, transparent);
}

.rec-card-title {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
}

### _globals.css

/* web/styles/_globals.css */

:root {
  /* Default: Sunset Theme */
  --bg: #fff5f0;
  --text: #2c0e37;
  --navy: #2c0e37;
  --gold: #fc8452;
  --burgundy: #b8293d;
  --card-radius: 0.8rem;
}

/* --- Theme Variations --- */
.theme-ocean {
  --bg: #f0f9ff;
  --text: #0e3d59;
  --navy: #0e3d59;
  --gold: #7db7c4;
  --burgundy: #274472;
}
.theme-forest {
  --bg: #f0fbf4;
  --text: #12372a;
  --navy: #12372a;
  --gold: #6aa84f;
  --burgundy: #305936;
}
.theme-night {
  --bg: #130b19;
  --text: #fce3da;
  --navy: #2c0e37;
  --gold: #fc8452;
  --burgundy: #b8293d;
}

/* --- Base Styles --- */
body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  transition: background-color 0.3s, color 0.3s;
}

.main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.footer {
  text-align: center;
  padding: 2rem 0 1rem;
  font-size: 0.9rem;
  color: var(--text);
  opacity: 0.7;
}

/* --- Theme-specific Overrides --- */
.theme-night .hero h1,
.theme-night .results-section h2,
.theme-night .footer {
  color: var(--gold);
}
.theme-night .nav-item {
    color: var(--text);
}
.theme-night .nav-item:hover, .theme-night .nav-item.active {
    color: var(--gold);
}

### _header.css

.header {
  display: grid;
  grid-template-columns: 1fr auto 1fr; /* This is the key change */
  align-items: center;
  padding: 1rem 2rem;
  background: var(--navy);
  color: var(--gold);
}

/* Place the logo in the first column */
.logo {
  justify-self: start; /* Align to the start of its column */
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--gold);
}

/* The nav is automatically in the second (auto) column */
.nav {
  display: flex;
  gap: 2rem;
}

/* The theme selector is automatically in the third column */
#themeSelector {
  justify-self: end; /* Align to the end of its column */
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  background: var(--gold);
  color: var(--navy);
  font-weight: 600;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%232c0e37' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  padding-right: 2rem;
}

/* Styling for the nav links themselves remains the same */
.nav-item {
  color: #fce3da;
  text-decoration: none;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s ease;
}

.nav-item:hover {
  color: var(--burgundy);
}

.nav-item.active {
  color: var(--burgundy);
  font-weight: 700;
}

### _modal.css

/* web/styles/_modal.css */

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  backdrop-filter: blur(5px);
}

.modal-overlay.hidden {
  display: none;
}

.modal-content {
  color: var(--text);
  border-radius: var(--card-radius);
  max-width: 800px;
  width: 100%;
  position: relative;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  
  max-height: 80vh; 
  display: flex;

  background-size: cover;
  background-position: center;
  overflow: hidden; 
}

.modal-content::before {
    content: '';
    position: absolute;
    inset: 0;
    background-color: var(--bg);
    opacity: 0.9;
    z-index: 1;
}

.modal-close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: var(--text);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  z-index: 3;
}
.modal-close-btn:hover {
  opacity: 1;
}

.modal-body {
  width: 100%;
  padding: 2.5rem;
  position: relative;
  z-index: 2;
  overflow-y: auto; 
}

.modal-top-section {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
  align-items: start;
}

.modal-poster-container img {
  width: 100%;
  border-radius: var(--card-radius);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

.modal-logo {
    max-width: 55%;
    height: auto;
    margin-bottom: 1rem;
    object-fit: contain;
}

#modal-title {
  margin: 0 0 0.5rem;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--text);
}
.theme-night #modal-title {
    color: var(--gold);
}

.modal-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  opacity: 0.7;
  margin-bottom: 1rem;
}

.modal-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
.genre-tag {
  background: var(--gold);
  color: var(--navy);
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
}

#modal-synopsis {
  line-height: 1.6;
}

/* MODIFIED: The button no longer has a top margin, its container does */
.modal-action-btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background-color: var(--burgundy);
  color: #fff !important; 
  text-decoration: none;
  font-weight: 700;
  border-radius: var(--card-radius);
  transition: background-color 0.2s, transform 0.2s;
  text-align: center;
  border: none; /* Good practice for buttons */
  cursor: pointer;
}

.modal-action-btn:hover {
  background-color: var(--navy);
  transform: translateY(-2px);
}

.modal-action-btn.hidden {
  display: none;
}

/* --- NEW: Styles for the video player --- */
.modal-video-actions {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem; /* Space between player and synopsis */
}

.video-wrapper {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 ratio */
  height: 0;
  overflow: hidden;
  border-radius: var(--card-radius);
  background-color: #000;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  margin-top: 1rem;
}

.video-wrapper.hidden {
  display: none;
}

.video-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

/* Cast Styles */
.modal-cast h3 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: 700;
    border-bottom: 1px solid rgba(0,0,0,0.1);
    padding-bottom: 0.5rem;
}
.theme-night .modal-cast h3 {
    border-bottom-color: rgba(255,255,255,0.1);
}

.cast-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 1.5rem;
}
.cast-member {
    text-align: center;
}
.cast-member-img {
    width: 80px; 
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 0.5rem;
    background-color: rgba(0,0,0,0.1);
}
.cast-member-name {
    font-weight: 600;
    font-size: 0.9rem;
}
.cast-member-char {
    font-size: 0.8rem;
    opacity: 0.7;
}

### _search.css

/* web/styles/_search.css */

.hero {
  text-align: center;
  margin: 4rem 0;
}

.hero h1 {
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--navy);
}

.search-form {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.search-input {
  flex: 1;
  padding: 0.8rem 1.2rem;
  border: 1px solid var(--text);
  border-right: none;
  border-radius: var(--card-radius) 0 0 var(--card-radius);
  font-size: 1rem;
  background: var(--bg);
  color: var(--text);
}

.search-input:focus {
    outline: 2px solid var(--gold);
    outline-offset: -1px;
}

.search-button {
  padding: 0.8rem 1.5rem;
  border-radius: 0 var(--card-radius) var(--card-radius) 0;
  border: 1px solid var(--gold);
  background: var(--gold);
  color: var(--navy);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, opacity 0.2s;
}

.search-button:hover {
  background: var(--burgundy);
  border-color: var(--burgundy);
  color: var(--bg);
}

.search-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

### main.css

/* web/styles/main.css */
/* This file imports all other style partials. */

@import url('_globals.css');
@import url('_header.css');
@import url('_search.css');
@import url('_card.css');
@import url('_chat.css');
@import url('_modal.css');

/* Add future imports here, e.g., @import url('_chat.css'); */

### styles.css

/*
  Stream Guru – UI Stylesheet
*/

:root {
  /* Default: Sunset Theme */
  --bg: #fff5f0;
  --text: #2c0e37;
  --navy: #2c0e37;
  --gold: #fc8452;
  --burgundy: #b8293d;
  --card-radius: 0.8rem;
}

/* Theme Variations */
.theme-ocean {
  --bg: #f0f9ff;
  --text: #0e3d59;
  --navy: #0e3d59;
  --gold: #7db7c4;
  --burgundy: #274472;
}

.theme-forest {
  --bg: #f0fbf4;
  --text: #12372a;
  --navy: #12372a;
  --gold: #6aa84f;
  --burgundy: #305936;
}

.theme-night {
  --bg: #130b19;
  --text: #fce3da;
  --navy: #2c0e37;
  --gold: #fc8452;
  --burgundy: #b8293d;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  transition: background-color 0.3s, color 0.3s;
}

/* Header & Navigation */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: var(--navy);
  color: var(--gold);
}

.logo {
  font-weight: 800;
  font-size: 1.5rem;
}

.nav {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}
.nav-item {
  color: var(--gold);
  text-decoration: none;
  font-weight: 600;
  padding-bottom: 4px;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}
.nav-item:hover, .nav-item.active {
  color: var(--burgundy);
  border-bottom-color: var(--burgundy);
}

#themeSelector {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  border: none;
  background: var(--gold);
  color: var(--navy);
  font-weight: 600;
  cursor: pointer;
}

/* Main Content & Hero */
.main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
.hero {
  text-align: center;
  margin: 2rem 0 4rem;
}
.hero h1 {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--navy);
}
.search-form {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.search-input {
  flex: 1;
  padding: 0.8rem 1.2rem;
  border: 1px solid var(--text);
  border-radius: var(--card-radius) 0 0 var(--card-radius);
  font-size: 1rem;
  background: var(--bg);
  color: var(--text);
}
.search-button {
  padding: 0.8rem 1.5rem;
  border-radius: 0 var(--card-radius) var(--card-radius) 0;
  border: 1px solid var(--gold);
  background: var(--gold);
  color: var(--navy);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.search-button:hover {
  background: var(--burgundy);
  border-color: var(--burgundy);
  color: var(--bg);
}

/* Results Grid */
.results-section h2 {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--navy);
  margin-bottom: 1.5rem;
}
.movie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.5rem;
}
.placeholder-text, .error-text {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text);
  opacity: 0.7;
}
.error-text {
  color: var(--burgundy);
  font-weight: 600;
}

/* Movie Card */
.movie-card {
  text-decoration: none;
  color: inherit;
  display: block;
  transition: transform 0.2s;
}
.movie-card:hover {
  transform: translateY(-5px);
}
.poster-container {
  position: relative;
  border-radius: var(--card-radius);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.poster-container img {
  width: 100%;
  height: auto;
  display: block;
}
.poster-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  color: #fff;
}
.poster-overlay .title {
  font-weight: 600;
  line-height: 1.3;
}
.poster-overlay .score {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--burgundy);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}
.movie-title-standalone {
  font-weight: 600;
  margin-top: 0.75rem;
  color: var(--text);
}

/* Dark theme overrides */
.theme-night .hero h1,
.theme-night .results-section h2 {
  color: var(--gold);
}

/* Footer */
.footer {
  text-align: center;
  padding: 2rem 0 1rem;
  font-size: 0.9rem;
  color: var(--text);
  opacity: 0.7;
}

----------------------------------------
----------------------------------------