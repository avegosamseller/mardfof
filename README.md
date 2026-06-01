# Agent Office

**Self-growing AI teams in a pixel-art virtual office — powered by Groq or your local LLM.**

Watch AI agents walk to desks, think, collaborate, hire interns, assign tasks to each other, execute code, search the web, and grow their team — all rendered in real-time pixel art with persistent memory across sessions.

> **Zero lock-in.** Runs with Groq (blazing fast cloud inference) or 100% locally with Ollama. Swap providers with a single env var.

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
| ⚡ **Groq Support** | Ultra-fast inference via Groq LPU cloud |

---

## Architecture

```
agent-office/
├── packages/
│   ├── core/       # Agent state machine, Memory, Tasks, Office grid
│   ├── adapters/   # GroqAdapter, OllamaAdapter, OpenAICompatibleAdapter
│   ├── server/     # Colyseus rooms, ToolExecutor, MemoryStore (SQLite)
│   └── ui/         # Phaser.js game + React overlay
└── docker-compose.yml
```

**Data Flow:**
```
LLM (Groq/Ollama) ←→ Adapter ←→ Agent.think() ←→ Colyseus State ←→ Phaser + React
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

### Option A: Using Groq (Recommended — Fastest)

```bash
# 1. Clone
git clone https://github.com/avegosamseller/mardfof.git
cd mardfof

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY (get it at https://console.groq.com)

# 4. Build all packages
npm run build

# 5. Start server (Terminal 1)
npm run start

# 6. Start UI (Terminal 2)
npm run start:ui
```

### Option B: Using Ollama (Local/Offline)

```bash
# 1. Clone
git clone https://github.com/avegosamseller/mardfof.git
cd mardfof

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env:
#   LLM_PROVIDER=ollama
#   LLM_MODEL=hermes3:latest

# 4. Pull model
ollama pull hermes3

# 5. Build all packages
npm run build

# 6. Start server (Terminal 1)
npm run start

# 7. Start UI (Terminal 2)
npm run start:ui
```

Open **http://localhost:5173** — watch Alice and Bob come alive!

---

## Docker Deployment

### With Groq (no GPU needed):
```bash
# Set your Groq API key
export GROQ_API_KEY=gsk_your_key_here

docker compose up --build
```

### With Ollama (GPU/local):
```bash
export LLM_PROVIDER=ollama
export LLM_MODEL=hermes3:latest

docker compose --profile ollama up --build
```

This starts:
- **Server** (port 3000) — Colyseus + REST API
- **UI** (port 80) — Nginx serving built frontend
- **Ollama** (port 11434, only with `--profile ollama`) with GPU passthrough

> For CPU-only Ollama: remove `deploy.resources` from `docker-compose.yml`

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Provider: "groq" (default) or "ollama"
LLM_PROVIDER=groq

# Model selection
# Groq: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768, gemma2-9b-it
# Ollama: hermes3:latest, llama3:latest, etc.
LLM_MODEL=llama-3.3-70b-versatile

# Groq (get key at https://console.groq.com)
GROQ_API_KEY=gsk_your_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1

# Ollama (local inference)
OLLAMA_URL=http://localhost:11434

# Server
PORT=3000
```

### Groq Models (Recommended)

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| `llama-3.3-70b-versatile` | Fast | Excellent | Default, best overall |
| `llama-3.1-8b-instant` | Ultra-fast | Good | Quick responses, lower cost |
| `mixtral-8x7b-32768` | Fast | Great | Long context tasks |
| `gemma2-9b-it` | Ultra-fast | Good | Lightweight tasks |

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
| `@agent-office/adapters` | GroqAdapter, OllamaAdapter, OpenAICompatibleAdapter, PromptBuilder |
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
