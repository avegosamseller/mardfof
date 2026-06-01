# Agent Office

**Self-growing AI teams in a pixel-art virtual office — powered by your local LLM.**

Watch AI agents walk to desks, think, collaborate, hire interns, assign tasks to each other, execute code, search the web, and grow their team — all rendered in real-time pixel art with persistent memory across sessions.

> **Zero lock-in.** Runs 100% locally with Ollama/Hermes. Swap for any OpenAI-compatible API.

---

## Features

| Feature | Description |
|---------|-------------|
| 🧠 **LLM-Powered Agents** | Each agent has their own brain with personality traits |
| 💬 **Agent-to-Agent Chat** | Agents talk to each other autonomously |
| 🎯 **Click-to-Follow** | Click any agent to have the camera track them |
| 📋 **Task Assignment** | Assign tasks from the UI or let agents create them |
| 🤝 **Dynamic Hiring** | Agents can hire new team members on their own |
| 🔧 **Tool Execution** | Sandboxed JS execution, web search, note-taking |
| 💾 **Persistent Memory** | SQLite-backed memories survive restarts |
| 🔍 **Semantic Search** | Ollama embeddings + cosine similarity |
| 💡 **Emote Bubbles** | Action-specific emoji above agent sprites |

---

## Architecture

```
agent-office/
├── packages/
│   ├── core/       # Agent state machine, Memory, Tasks, Office grid
│   ├── adapters/   # OllamaAdapter, OpenAICompatibleAdapter
│   ├── server/     # Colyseus rooms, ToolExecutor, MemoryStore (SQLite)
│   └── ui/         # Phaser.js game + React overlay
└── docker-compose.yml
```

**Data Flow:**
```
LLM (Ollama/Hermes) ←→ Adapter ←→ Agent.think() ←→ Colyseus State ←→ Phaser + React
                                        ↕                  ↕
                                 MemoryStore (SQLite)   ToolExecutor
```

---

## Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | >= 18 | Runtime |
| **npm** | >= 9 | Package manager |
| **Ollama** | Latest | Local LLM inference |

---

## Quick Start (Local Development)

```bash
# 1. Clone
git clone https://github.com/avegosamseller/mardfof.git
cd mardfof

# 2. Install dependencies
npm install

# 3. Pull model (adjust to your model)
ollama pull hermes3

# 4. Build all packages
npm run build

# 5. Start server (Terminal 1)
npm run start

# 6. Start UI (Terminal 2)
npm run start:ui
```

Open **http://localhost:5173** — watch Alice and Bob come alive!

---

## Docker Deployment

```bash
docker compose up --build
```

This starts:
- **Ollama** (port 11434) with GPU passthrough
- **Server** (port 3000) — Colyseus + REST API
- **UI** (port 80) — Nginx serving built frontend

> For CPU-only: remove `deploy.resources` from `docker-compose.yml`

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# LLM endpoint
OLLAMA_URL=http://localhost:11434
LLM_MODEL=hermes3:latest

# For OpenAI-compatible endpoint (homeserver, etc.)
# OPENAI_BASE_URL=http://your-homeserver:8080/v1
# OPENAI_API_KEY=your-key

# Server port
PORT=3000
```

### Using Your Hermes Agent (Homeserver)

If you run Hermes via Ollama on your homeserver:

```env
OLLAMA_URL=http://YOUR_HOMESERVER_IP:11434
LLM_MODEL=hermes3:latest
```

If you have an OpenAI-compatible endpoint:

Edit `packages/server/src/rooms/OfficeRoom.ts` and swap the adapter:

```typescript
import { OpenAICompatibleAdapter } from '@agent-office/adapters';

// Replace OllamaAdapter with:
private adapter = new OpenAICompatibleAdapter(
    'http://your-homeserver:8080/v1',
    'your-api-key',
    'hermes'
);
```

### Adding/Customizing Agents

Edit `packages/server/src/rooms/OfficeRoom.ts`:

```typescript
await setupCoreAgent('charlie', 'Charlie', 'Designer', 15, 15);
```

### Adding Custom Tools

Edit `packages/server/src/tools/ToolExecutor.ts`:

```typescript
case 'my_custom_tool':
    return this.myCustomFunction(params);
```

---

## Connecting to Telegram Bot

To bridge your Telegram Hermes agent:

1. Create a relay server that receives prompts via HTTP and forwards to your Telegram bot
2. Or expose your Ollama endpoint that Hermes uses
3. Point `OLLAMA_URL` to wherever your model lives

---

## Package Details

| Package | Description |
|---------|-------------|
| `@agent-office/core` | Agent lifecycle, Office grid, Task system, Memory |
| `@agent-office/adapters` | OllamaAdapter, OpenAICompatibleAdapter, PromptBuilder |
| `@agent-office/server` | Colyseus room, ToolExecutor, MemoryStore (SQLite) |
| `@agent-office/ui` | Phaser.js renderer + React overlay |

---

## How It Works

```
Open browser → pixel-art office loads → Alice & Bob spawn
  → Each agent thinks every ~15s via LLM
  → LLM returns: { thought, action, target, toolCall }
  → Server executes action (move, talk, use_tool, hire)
  → Colyseus syncs to all browsers in real-time
  → SQLite + embeddings persist everything
  → Agents can hire new members (max 7)
```

---

## License

MIT
