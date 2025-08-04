// web/scripts/modal.js

import { fetchMediaDetails } from './api.js';

let modal, modalContent, modalCloseBtn, modalPoster, modalLogo, modalTitle;
let modalReleaseDate, modalRuntime, modalGenres, modalSynopsis, modalCastList;
let modalTrailerBtn, modalVideoWrapper, modalWatchProviders, modalProviderList;

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

          // --- THIS IS THE FIX ---
          // The issue was that the duplicated logic in main.js was likely different.
          // We will ensure that this canonical function correctly handles null paths
          // and directly uses the valid URL from the database.
          const profileSrc = actor.profile_path ? actor.profile_path : 'https://placehold.co/185x278?text=No+Image';

          castMemberDiv.innerHTML = `
              <img src="${profileSrc}" alt="${actor.name}" class="cast-member-img">
              <p class="cast-member-name">${actor.name}</p>
              <p class="cast-member-char">${actor.character}</p>
          `;
          // --- END OF FIX ---
          
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
  modalWatchProviders = document.getElementById('modal-watch-providers');
  modalProviderList = document.getElementById('modal-provider-list');
  
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