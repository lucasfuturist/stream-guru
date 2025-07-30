# Stream Guru 🎬

Stream Guru is a modern, full-stack, AI-powered recommendation engine for movies and TV shows. It's designed to provide users with semantically relevant and context-aware suggestions through a fast, clean, and feature-rich web interface.

## ✨ Core Features

*   **AI-Powered Chat:** A charismatic and intelligent chatbot (powered by GPT-4o-mini) that understands natural language, "vibes," and complex queries with multiple filters (genre, actor, release year, runtime).
*   **Semantic Search:** Utilizes OpenAI's `text-embedding-3-small` and Supabase's `pgvector` extension to find movies that *feel* similar, not just those that match keywords.
*   **"Where to Watch" Integration:** Displays the streaming services (Netflix, Hulu, etc.) where a movie or show is currently available.
*   **Embedded Trailer Player:** Watch trailers directly within the application for a seamless experience.
*   **Trending Homepage:** The homepage dynamically loads the latest trending titles on page load.
*   **Persistent Chat History:** Remembers your conversation history using `localStorage`.
*   **Dynamic Theming:** A user-selectable theme system (Sunset, Ocean, Forest, Night).

## 🛠️ Tech Stack

*   **Backend:** [Supabase](https://supabase.com/)
    *   **Database:** PostgreSQL with `pgvector`
    *   **API Layer:** Deno Edge Functions
*   **AI:** [OpenAI](https://openai.com/)
    *   **Chat & Parsing:** GPT-4o-mini
    *   **Embeddings:** text-embedding-3-small
*   **Frontend:** Vanilla Stack
    *   HTML5
    *   Modern CSS (Flexbox, Grid)
    *   JavaScript (ES Modules)
*   **Data Pipeline:**
    *   Node.js & Deno for scripting (`tmdb_seed.ts`, `embed_all.ts`)
    *   PowerShell for orchestration (`ingest.ps1`)

## 🚀 Getting Started

1.  Clone the repository.
2.  Set up your `.env` file with your Supabase and OpenAI API keys.
3.  Run `npm run seed` to populate your database from TMDb.
4.  Run `npm run embed` to generate the AI embeddings for your data.
5.  Open the `web/index.html` file in your browser to start using the app.