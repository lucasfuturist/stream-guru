// web/scripts/chat.js

import { initTheme } from './theme.js';
import { fetchAiResponse, fetchMediaMatches } from './api.js';
import { initModal } from './modal.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const submitButton = document.getElementById('chat-submit-button');
  
  // Define a key for localStorage
  const CHAT_HISTORY_KEY = 'streamGuruChatHistory';

  initModal(chatMessages);

  /**
   * Saves the current state of the chat to localStorage.
   */
  function saveChatHistory() {
    const messages = Array.from(chatMessages.querySelectorAll('.chat-message'));
    // Convert the HTML of the messages into a savable data structure
    const history = messages.map(msg => {
      const bubble = msg.querySelector('.message-bubble');
      const sender = msg.classList.contains('user') ? 'user' : 'assistant';
      return { html: bubble.innerHTML, sender };
    });
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  }

  /**
   * Loads the chat history from localStorage and populates the chat window.
   */
  function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY));
    chatMessages.innerHTML = ''; // Start with a clean slate

    if (history && history.length > 0) {
      history.forEach(msg => appendMessage(msg.html, msg.sender));
    } else {
      // If no history exists, add the default welcome message
      appendMessage(
        'Hi! I\'m StreamGuru. Ask me for a recommendation, like "funny comedies from the 90s" or "a space opera with a great soundtrack".',
        'assistant'
      );
      saveChatHistory(); // Save this initial state
    }
  }

  /**
   * Appends a message to the chat window (but does not save it).
   */
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
    
    // Create temporary bubbles that won't be saved immediately
    const wittyResponseBubble = appendMessage('Thinking...', 'assistant');
    wittyResponseBubble.classList.add('thinking');

    try {
      const { ai_message, filters } = await fetchAiResponse(userMessage);
      
      wittyResponseBubble.querySelector('.message-bubble').textContent = ai_message.trim() || "On it...";
      wittyResponseBubble.classList.remove('thinking');
      
      const searchBubble = appendMessage('Searching for matches...', 'assistant');
      searchBubble.classList.add('thinking');

      const recommendations = await fetchMediaMatches(userMessage, filters);
      const formattedHtml = formatRecommendations(recommendations);

      searchBubble.querySelector('.message-bubble').innerHTML = formattedHtml;
      searchBubble.classList.remove('thinking');

    } catch (error) {
      console.error("Chat error:", error);
      wittyResponseBubble.querySelector('.message-bubble').textContent = "Sorry, I ran into an error. Please try again.";
      wittyResponseBubble.classList.remove('thinking');
    } finally {
      chatInput.disabled = false;
      submitButton.disabled = false;
      chatInput.focus();
      // Now that the entire turn is complete, save the final state of the chat.
      saveChatHistory();
    }
  }

  if (chatForm) {
    chatForm.addEventListener('submit', handleChatSubmit);
  }

  // Load the history as soon as the page loads
  loadChatHistory();
});