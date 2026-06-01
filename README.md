# Agent Office

**AI agent team in a pixel-art virtual office — controlled by your Hermes Telegram bot.**

Hermes is the **boss**. He gives context, assigns tasks, and directs the team. The agents in the office (Alice, Bob, etc.) **execute the work** autonomously — thinking, collaborating, using tools, and reporting back to Hermes.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  YOU (Telegram)                                          │
│  Chat with Hermes bot                                   │
│  /task Build the login page                             │
│  /context We're building a SaaS product                 │
│  /status                                                │
└──────────────────────┬──────────────────────────────────┘
                       │ Telegram API
                       ▼
┌─────────────────────────────────────────────────────────┐
│  TelegramBridge                                          │
│  Translates commands → Agent Office actions              │
│  Reports agent progress back to Telegram                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Agent Office Server (Colyseus)                          │
│  Alice (Engineer) + Bob (PM) + hired agents              │
│  Think every 15s → Act → Collaborate → Use tools         │
│  Memory persists in SQLite                               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  LLM (Ollama + Hermes3 on your homeserver)               │
│  Powers agent thinking                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Telegram Commands (Hermes as Boss)

| Command | What it does |
|---------|-------------|
| `/task <desc>` | Assign a task to the best available agent |
| `/context <text>` | Set global direction for all agents (high priority) |
| `/ask <question>` | Ask all agents a question (they reply next cycle) |
| `/status` | Get current status of all agents |
| `/report` | Get full detailed report |
| `/hire <name> <role>` | Hire a new agent into the office |
| `/fire <name>` | Remove an agent |
| *(any message)* | Treated as a directive from the boss |

**Agents automatically report back** when they:
- Respond to your question
- Complete a tool execution
- Have an important conversation

---

## Requirements

| Tool | Purpose |
|------|---------|
| **Node.js** >= 18 | Runtime |
| **Ollama** | LLM on your homeserver |
| **Telegram Bot** | Created via @BotFather |

---

## Setup

### 1. Create Telegram Bot

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`, follow instructions
3. Copy the bot token

### 2. Get Your Chat ID

1. Start a chat with your new bot
2. Send any message
3. Open: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Find `"chat":{"id": 123456789}` — that's your chat ID

### 3. Install & Configure

```bash
git clone https://github.com/avegosamseller/mardfof.git
cd mardfof
npm install

# Create .env file
cp .env.example .env
```

Edit `.env`:
```env
OLLAMA_URL=http://localhost:11434
LLM_MODEL=hermes3:latest
TELEGRAM_BOT_TOKEN=7123456789:AAH...your-token
TELEGRAM_CHAT_ID=123456789
```

### 4. Pull the model & run

```bash
ollama pull hermes3
npm run build
npm run start        # Server + Telegram Bridge
npm run start:ui     # (Optional) Visual UI on localhost:5173
```

### 5. Test it!

Open Telegram, send to your bot:
```
/status
```

You should get a response showing Alice and Bob in the office.

Then try:
```
/task Build a REST API for user authentication
```

Watch Alice pick it up and start working!

---

## Docker Deployment

```bash
docker compose up --build
```

Make sure to set env vars in `docker-compose.yml` or a `.env` file.

---

## Architecture

```
packages/
├── core/       → Agent brain, memory, task system, grid
├── adapters/   → OllamaAdapter, OpenAICompatibleAdapter
├── server/
│   ├── rooms/        → OfficeRoom (main game loop)
│   ├── telegram/     → TelegramBridge (Hermes connection)
│   ├── tools/        → ToolExecutor (code, search, notes)
│   ├── memory/       → MemoryStore (SQLite + embeddings)
│   └── schema/       → Colyseus state schema
└── ui/         → Phaser.js pixel-art + React overlay
```

---

## Configuration

### Change LLM Model

In `.env`:
```env
LLM_MODEL=llama3.2:latest
# or
LLM_MODEL=mistral:latest
```

### Auto-Reports to Telegram

Set interval (in milliseconds):
```env
TELEGRAM_REPORT_INTERVAL=300000  # Every 5 minutes
```

### Add More Agents

From Telegram:
```
/hire Charlie Designer
/hire Diana Engineer
```

Or edit `OfficeRoom.ts` to add permanent agents.

---

## What Agents Can Do

| Capability | Description |
|-----------|-------------|
| `code_execute` | Run JavaScript in sandbox |
| `web_search` | Search DuckDuckGo |
| `write_note` | Save notes |
| `create_task` | Create & assign tasks to each other |
| `hire_agent` | Hire new team members |

---

## License

MIT
