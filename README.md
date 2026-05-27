# quickChat

A personal AI chat application powered by [Ollama](https://ollama.com), built with Nuxt 3 and Vuetify 3. Supports multiple AI personas, encrypted per-user storage, and automatic context summarization for long conversations.

## Features

- **Persona-based chats** — define AI personalities with custom system prompts, models and temperature
- **Ollama integration** — connects to a local Ollama instance; switch models per chat
- **Encrypted storage** — all chats and personas are AES-256-GCM encrypted at rest, keyed per user
- **Multi-user** — each user's data is fully isolated; configurable via environment variable
- **Context summarization** — long conversations are automatically summarized in the background to stay within model context limits
- **Retry** — resend the last message with one click if something went wrong
- **PWA** — installable as a standalone app
- **Dark theme** by default

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com) running locally (default: `http://localhost:11434`)
- At least one model pulled, e.g. `ollama pull llama3`

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:8888](http://localhost:8888). Default login: `admin` / `admin`.

## Configuration

All configuration is done via environment variables.

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | `quickchat-secret-change-me` | Secret used to derive per-user encryption keys. **Change this in production.** |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL of your Ollama instance |
| `QUICKCHAT_USERS` | admin/admin | JSON array of users (see below) |

### Adding Users

Passwords are stored as SHA-256 hashes. Generate a hash:

```bash
echo -n "yourpassword" | sha256sum | cut -d' ' -f1
```

Then set `QUICKCHAT_USERS` as a JSON array:

```bash
export QUICKCHAT_USERS='[
  {"username":"admin","passwordHash":"8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"},
  {"username":"alice","passwordHash":"<hash>"}
]'
npm run dev
```

> The default admin hash above is `sha256("admin")`. Replace it in production.

## Database

Chats and personas are stored in a SQLite database at `~/.quickChat/quickchat.sqlite3`. The directory is created automatically on first run.

All payload columns are encrypted with **AES-256-GCM**. The encryption key is derived per user via **PBKDF2** using `SESSION_SECRET + username` — meaning one user cannot read another's data even with direct database access.

## Context Summarization

When a conversation exceeds **20 messages**, the older messages are automatically summarized by Ollama and replaced with a compact summary. The last **10 messages** are always kept as full context. A subtle banner in the chat UI indicates when summarization has occurred (hover to read the summary).

Thresholds can be adjusted in `server/utils/summarize.ts`:

```ts
export const SUMMARY_THRESHOLD = 20
export const RECENT_KEEP = 10
```

## Project Structure

```
server/
  api/
    auth/        # Login, logout, session check
    chats/       # CRUD for chat sessions
    personas/    # CRUD for AI personas
    chat/        # Ollama completion endpoint (with summarization)
    ollama/      # Model listing
  plugins/
    database.ts  # DB table initialization on startup
  utils/
    auth.ts      # Session management (cookie-based, no h3 dependency)
    dbInit.ts    # DB schema + AES-256-GCM encryption helpers
    summarize.ts # Context summarization logic
app/
  pages/
    chat/[id].vue   # Main chat view
    chats.vue        # Chat list
    personas.vue     # Persona management
shared/
  types.ts       # Shared TypeScript interfaces
```

## Scripts

```bash
npm run dev       # Start dev server on :8888
npm run build     # Production build
npm run preview   # Preview production build
```
