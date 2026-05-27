# quickChat

A personal, self-hosted AI chat application powered by [Ollama](https://ollama.com), built with Nuxt 3 and Vuetify 3. Supports multiple AI personas, MCP tool calling, encrypted per-user storage, and automatic context summarization.

## Features

### Core
- **Persona-based chats** — define AI personalities with custom system prompts, models, and temperature
- **Ollama integration** — connects to a local Ollama instance; switch models per chat
- **Streaming responses** — tokens stream in real time via SSE; Ollama keeps running even if you navigate away
- **Context summarization** — long conversations are automatically summarized to stay within model context limits
- **Retry** — resend the last message with one click
- **PWA** — installable as a standalone app
- **Dark theme** by default

### MCP Tool Calling
- **MCP server support** — connect AI personas to tools via Model Context Protocol
- **Client-side tool execution** — all tool calls are executed in the browser; external requests never go through the server
- **Built-in Web Search** — search via DuckDuckGo (no key required) or Brave Search (optional API key for full results); also fetches and renders URLs including images
- **Built-in File Access** — read local files and directories by path (text, code, images); supports Windows and Linux/Mac paths
- **Image rendering in chat** — images from file access or web fetch are displayed inline (≤ 200 KB full size, > 200 KB thumbnail with click-to-open)
- **Per-persona tool enable/disable** — each persona independently controls which MCP servers are active
- **Tool call cards** — active and completed tool calls shown as collapsible cards during streaming

### Storage & Security
- **Encrypted storage** — all chats, personas, and MCP server configs are AES-256-GCM encrypted at rest, keyed per user via PBKDF2
- **Multi-user** — each user's data is fully isolated
- **Session cookies** — server-side session management, no third-party auth dependencies

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com) running locally (default: `http://localhost:11434`)
- A model that supports tool calls for MCP features, e.g. `ollama pull llama3.1` or `ollama pull qwen2.5`

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:8888](http://localhost:8888). Default login: `admin` / `admin`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | `quickchat-secret-change-me` | Derives per-user encryption keys. **Change this in production.** |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL of your Ollama instance |
| `QUICKCHAT_USERS` | `admin/admin` | JSON array of `{username, passwordHash}` (see below) |

### Adding Users

Passwords are stored as SHA-256 hashes:

```bash
echo -n "yourpassword" | sha256sum | cut -d' ' -f1
```

```bash
export QUICKCHAT_USERS='[
  {"username":"admin","passwordHash":"8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"},
  {"username":"alice","passwordHash":"<hash>"}
]'
```

> The default hash above is `sha256("admin")`. Replace it before exposing to a network.

## MCP Tools Setup

### Built-in Web Search
1. Go to **MCP Servers** → **Add Server** → select **Built-in** → **Web Search** → Save
2. Edit a persona → enable **Web Search** → Save
3. Use a tool-capable model (`llama3.1`, `qwen2.5`, `mistral-nemo`)

Optionally add a [Brave Search API key](https://api.search.brave.com) (free tier: 2 000 req/month) for full web results instead of DuckDuckGo instant answers.

### Built-in File Access
1. Go to **MCP Servers** → **Add Server** → select **Built-in** → **File Access** → Save
2. Enable it on a persona
3. Tell the AI a file path, e.g. *"Read /home/user/notes.txt"* or *"Show me C:\Users\user\image.png"*

Since quickChat runs locally, the Nitro server reads files from your own machine on your behalf.

## Database

SQLite at `.data/quickchat.sqlite`. Tables: `chats`, `personas`, `mcp_servers` — all with per-user AES-256-GCM encrypted `payload` columns. One user cannot read another's data even with direct DB access.

## Context Summarization

When a conversation exceeds **20 messages**, older messages are summarized by Ollama and replaced with a compact summary. The last **10 messages** are always kept as full context. A banner in the chat UI indicates summarization (hover to read the summary).

Thresholds in `server/utils/summarize.ts`:
```ts
export const SUMMARY_THRESHOLD = 20
export const RECENT_KEEP = 10
```

## Project Structure

```
server/
  api/
    auth/           # Login, logout, session check
    chats/          # CRUD for chat sessions
    personas/       # CRUD for AI personas
    mcp/            # CRUD for MCP server configurations
    chat/
      complete.post.ts  # Ollama completion + MCP tool-call loop (SSE)
      stream.get.ts     # SSE stream reconnect endpoint
      stop.delete.ts    # Abort a running completion
      tool-result.post.ts  # Receives browser-executed tool results
    fs/
      read.get.ts   # Read local file (text or image as base64)
      list.get.ts   # List directory contents
    ollama/         # Model listing
  plugins/
    database.ts     # DB schema initialization on startup
  utils/
    auth.ts         # Cookie-based session (zero h3 imports)
    dbInit.ts       # DB schema + AES-256-GCM encryption helpers
    summarize.ts    # Context summarization
    jobRegistry.ts  # Background SSE job tracking (survive client disconnect)
    toolCallRegistry.ts  # Pause/resume tool-call loop awaiting browser result
    mcpClient.ts    # MCP SDK client (for stdio/HTTP server types)
app/
  pages/
    chat/[id].vue   # Chat view with streaming, tool call cards, image rendering
    chats.vue       # Chat list
    personas.vue    # Persona management with MCP server toggles
    mcp.vue         # MCP server management (built-in / stdio / HTTP)
    settings.vue    # Ollama URL, model config
    graph.vue       # Conversation graph visualization
  composables/
    useBuiltinTools.ts   # Built-in MCP server definitions + browser-side execute()
    useImageRenderer.ts  # [IMAGE:...] marker → inline <img> with size threshold
  layouts/
    default.vue     # App shell + navigation
shared/
  types.ts          # Shared TypeScript interfaces (ChatMessage, AiPersona, McpServer, …)
```

## Scripts

```bash
npm run dev       # Dev server on :8888
npm run build     # Production build
npm run preview   # Preview production build
```

## License

GPL-3.0-only — see [LICENSE](LICENSE).
