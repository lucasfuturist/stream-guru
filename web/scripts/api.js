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