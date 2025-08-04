// web/scripts/main.js

import { initTheme } from './theme.js';
// --- THIS IS THE FIX ---
// We now only import the functions that this page actually uses.
// fetchAiResponse and fetchMediaMatches have been removed.
import { fetchTrending, fetchFilteredMedia, fetchMediaDetails, fetchSearchResults } from './api.js';
// --- END OF FIX ---
import { displayMovies, displayError, displayLoading } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // --- Get main page elements ---
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchButton = document.querySelector('.search-button');
  const movieGrid = document.getElementById('movie-grid');

  // --- Get filter elements ---
  const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
  const filterControls = document.getElementById('filter-controls');
  const genreFilter = document.getElementById('genre-filter');
  const runtimeFilter = document.getElementById('runtime-filter');
  const runtimeValue = document.getElementById('runtime-value');
  const actorFilter = document.getElementById('actor-filter');
  const applyFiltersBtn = document.getElementById('apply-filters-btn');

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
  const modalWatchProviders = document.getElementById('modal-watch-providers');
  const modalProviderList = document.getElementById('modal-provider-list');
  
  let currentTrailerKey = null;

  // --- Event Listener to show/hide filters ---
  if (toggleFiltersBtn && filterControls) {
    toggleFiltersBtn.addEventListener('click', () => {
      filterControls.classList.toggle('hidden');
    });
  }

  async function handleSearch(event) {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    searchInput.disabled = true;
    searchButton.disabled = true;
    searchButton.textContent = 'Searching...';
    displayLoading(query);

    try {
      const searchResults = await fetchSearchResults(query);
      displayMovies(searchResults, `Results for "${query}"`);
    } catch (error) {
      displayError(error.message);
    } finally {
      searchInput.disabled = false;
      searchButton.disabled = false;
      searchButton.textContent = 'Search';
    }
  }
  
  async function handleFilterSearch() {
    applyFiltersBtn.disabled = true;
    applyFiltersBtn.textContent = 'Applying...';
    
    const filters = {
      genre: genreFilter.value || null,
      actor_name: actorFilter.value.trim() || null,
      max_runtime: runtimeFilter.valueAsNumber < 240 ? runtimeFilter.valueAsNumber : null,
    };

    displayLoading('Applying filters...');

    try {
      const filteredResults = await fetchFilteredMedia(filters);
      displayMovies(filteredResults, 'Filtered Results');
    } catch (error) {
      displayError(error.message);
    } finally {
      applyFiltersBtn.disabled = false;
      applyFiltersBtn.textContent = 'Apply Filters';
    }
  }

  if (runtimeFilter && runtimeValue) {
    runtimeFilter.addEventListener('input', () => {
      if (runtimeFilter.value === '240') {
        runtimeValue.textContent = 'Any';
      } else {
        runtimeValue.textContent = `< ${runtimeFilter.value} min`;
      }
    });
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
            const profileSrc = actor.profile_path ? actor.profile_path : 'https://placehold.co/185x278?text=No+Image';
            castMemberDiv.innerHTML = `<img src="${profileSrc}" alt="${actor.name}" class="cast-member-img"><p class="cast-member-name">${actor.name}</p><p class="cast-member-char">${actor.character}</p>`;
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

  // --- Attach Event Listeners ---
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearch);
  }
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', handleFilterSearch);
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