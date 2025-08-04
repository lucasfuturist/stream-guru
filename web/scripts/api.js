// web/scripts/api.js

import { supabase } from './supabase.js';

/**
 * Calls the main chatbot orchestrator function. This is the primary method for the chat UI.
 * @param {string} prompt - The user's latest message.
 * @returns {Promise<object>} - The full, audited response from the orchestrator.
 */
export async function callChatSession(prompt) {
  // We are now calling the new, consolidated, and much faster 'chat-final' function.
  const { data, error } = await supabase.functions.invoke('chat-final', {
    body: { prompt },
  });

  if (error) throw new Error(`Network error calling chat-final: ${error.message}`);
  if (data.error) throw new Error(`Application error in chat-final: ${data.error}`);
  return data;
}

/**
 * Fetches trending media using the Supabase client.
 * @returns {Promise<Array>}
 */
export async function fetchTrending() {
  const { data, error } = await supabase.functions.invoke('trending');
  if (error) throw new Error('Could not load trending titles.');
  return data.trending;
}

/**
 * Fetches media details using the Supabase client.
 * @param {number} tmdb_id - The TMDb ID of the media.
 * @returns {Promise<object>}
 */
export async function fetchMediaDetails(tmdb_id) {
  const { data, error } = await supabase.functions.invoke('get-details', {
    body: { tmdb_id },
  });
  if (error) throw new Error('Could not load media details.');
  return data.details;
}

/**
 * Fetches media via a direct keyword search.
 * @param {string} query - The user's search term.
 * @returns {Promise<Array>}
 */
export async function fetchSearchResults(query) {
  const { data, error } = await supabase.functions.invoke('search-media', {
    body: { query },
  });
  if (error) throw new Error('Failed to fetch search results.');
  return data.results;
}

/**
 * Fetches media based on a structured filter object.
 * @param {object} filters - The filter criteria.
 * @returns {Promise<Array>}
 */
export async function fetchFilteredMedia(filters) {
  const { data, error } = await supabase.functions.invoke('filter-media', {
    body: { filters },
  });
  if (error) throw new Error('Failed to fetch filtered results.');
  return data.results;
}