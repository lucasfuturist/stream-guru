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