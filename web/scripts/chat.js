// web/scripts/chat.js

import { initTheme } from './theme.js';
import { callChatSession } from './api.js';
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
    if (!recommendations || recommendations.length === 0) return "";
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
      const response = await callChatSession(userMessage);

      thinkingBubble.querySelector('.message-bubble').innerHTML = response.prose || "Here's what I found for you!";
      thinkingBubble.classList.remove('thinking');
      
      if (response.recs && response.recs.length > 0) {
        const formattedHtml = formatRecommendations(response.recs);
        appendMessage(formattedHtml, 'assistant');
      }

    } catch (error) {
      console.error("Chat error:", error);
      thinkingBubble.querySelector('.message-bubble').textContent = `Sorry, I ran into an error. ${error.message}`;
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

  // --- THIS IS THE FIX ---
  // We now clear the chat window before adding the initial welcome message.
  chatMessages.innerHTML = '';
  appendMessage(
    'Hi! I\'m StreamGuru. Ask me for a recommendation, like "funny comedies from the 90s" or "a space opera with a great soundtrack".',
    'assistant'
  );
});