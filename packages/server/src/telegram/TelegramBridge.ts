/**
 * TelegramBridge - Connects Hermes (Telegram bot) as the "Boss" of Agent Office.
 * 
 * Hermes sends commands/context → Bridge translates → Agents execute
 * Agents complete work → Bridge reports back → Hermes gets updates
 * 
 * Commands Hermes can send:
 *   /task <description>        - Assign a task to agents
 *   /ask <question>            - Ask agents something
 *   /status                    - Get current office status
 *   /hire <name> <role>        - Hire a new agent
 *   /fire <name>               - Remove an agent
 *   /context <text>            - Set global context/direction for all agents
 *   /report                    - Get full report of what agents did
 *   Any other message          - Treated as a directive from the boss
 */

export interface TelegramConfig {
    botToken: string;
    hermesChatId: string;  // Chat ID where Hermes lives (your chat with the bot)
    reportInterval: number; // ms between auto-reports (0 = disabled)
}

export interface BridgeEvent {
    type: 'task' | 'directive' | 'question' | 'hire' | 'fire' | 'status' | 'context' | 'report';
    content: string;
    params?: Record<string, string>;
    timestamp: string;
}

type EventHandler = (event: BridgeEvent) => void | Promise<void>;

export class TelegramBridge {
    private config: TelegramConfig;
    private polling: boolean = false;
    private lastUpdateId: number = 0;
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private reportTimer?: NodeJS.Timeout;
    private messageQueue: string[] = [];
    private isProcessing = false;

    constructor(config: TelegramConfig) {
        this.config = config;
    }

    /**
     * Start listening for messages from Hermes
     */
    async start(): Promise<void> {
        console.log('[TelegramBridge] Starting Hermes connection...');
        
        // Validate bot token
        const me = await this.apiCall('getMe');
        if (me.ok) {
            console.log(`[TelegramBridge] Connected as @${me.result.username}`);
        } else {
            throw new Error(`[TelegramBridge] Invalid bot token: ${JSON.stringify(me)}`);
        }

        // Start polling
        this.polling = true;
        this.pollLoop();

        // Auto-report timer
        if (this.config.reportInterval > 0) {
            this.reportTimer = setInterval(() => {
                this.emit({ type: 'report', content: 'auto', timestamp: new Date().toISOString() });
            }, this.config.reportInterval);
        }

        // Send startup message to Hermes
        await this.sendToHermes('🏢 Agent Office is online. I am ready to receive your commands, boss.\n\nCommands:\n/task <desc> - Assign work\n/ask <question> - Ask agents\n/status - Office status\n/hire <name> <role> - Hire agent\n/context <text> - Set direction\n/report - Get report\n\nOr just send any message as a directive.');
    }

    /**
     * Stop the bridge
     */
    stop(): void {
        this.polling = false;
        if (this.reportTimer) clearInterval(this.reportTimer);
        console.log('[TelegramBridge] Stopped.');
    }

    /**
     * Register event handler
     */
    on(eventType: string, handler: EventHandler): void {
        const handlers = this.eventHandlers.get(eventType) || [];
        handlers.push(handler);
        this.eventHandlers.set(eventType, handlers);
    }

    /**
     * Send a message to Hermes (the boss)
     */
    async sendToHermes(text: string): Promise<void> {
        // Queue messages to avoid rate limits
        this.messageQueue.push(text);
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Send a formatted report to Hermes
     */
    async sendReport(report: {
        agents: { name: string; status: string; currentTask: string; lastThought: string }[];
        completedTasks: string[];
        activeConversations: string[];
    }): Promise<void> {
        let msg = '📊 *Office Report*\n\n';

        msg += '👥 *Agents:*\n';
        for (const a of report.agents) {
            const statusEmoji = a.status === 'work' ? '💻' : a.status === 'talk' ? '💬' : '😌';
            msg += `${statusEmoji} *${a.name}* — ${a.currentTask || 'idle'}\n`;
            if (a.lastThought) msg += `   _"${a.lastThought}"_\n`;
        }

        if (report.completedTasks.length > 0) {
            msg += '\n✅ *Completed:*\n';
            for (const t of report.completedTasks) {
                msg += `• ${t}\n`;
            }
        }

        if (report.activeConversations.length > 0) {
            msg += '\n💬 *Recent:*\n';
            for (const c of report.activeConversations.slice(0, 5)) {
                msg += `• ${c}\n`;
            }
        }

        await this.sendToHermes(msg);
    }

    /**
     * Notify Hermes about an important event
     */
    async notifyEvent(event: string, details: string): Promise<void> {
        await this.sendToHermes(`🔔 *${event}*\n${details}`);
    }

    // ─── Private Methods ───

    private async pollLoop(): Promise<void> {
        while (this.polling) {
            try {
                const updates = await this.apiCall('getUpdates', {
                    offset: this.lastUpdateId + 1,
                    timeout: 30,
                    allowed_updates: ['message']
                });

                if (updates.ok && updates.result.length > 0) {
                    for (const update of updates.result) {
                        this.lastUpdateId = update.update_id;
                        await this.handleUpdate(update);
                    }
                }
            } catch (err) {
                console.error('[TelegramBridge] Poll error:', err);
                await this.sleep(5000);
            }
        }
    }

    private async handleUpdate(update: any): Promise<void> {
        const message = update.message;
        if (!message || !message.text) return;

        // Only process messages from the Hermes chat
        const chatId = String(message.chat.id);
        if (chatId !== this.config.hermesChatId) {
            console.log(`[TelegramBridge] Ignored message from chat ${chatId} (not Hermes)`);
            return;
        }

        const text = message.text.trim();
        const timestamp = new Date().toISOString();

        console.log(`[TelegramBridge] Hermes says: "${text}"`);

        let event: BridgeEvent;

        if (text.startsWith('/task ')) {
            event = { type: 'task', content: text.slice(6).trim(), timestamp };
        } else if (text.startsWith('/ask ')) {
            event = { type: 'question', content: text.slice(5).trim(), timestamp };
        } else if (text === '/status') {
            event = { type: 'status', content: '', timestamp };
        } else if (text === '/report') {
            event = { type: 'report', content: 'manual', timestamp };
        } else if (text.startsWith('/hire ')) {
            const parts = text.slice(6).trim().split(' ');
            const name = parts[0] || 'NewAgent';
            const role = parts.slice(1).join(' ') || 'Intern';
            event = { type: 'hire', content: name, params: { name, role }, timestamp };
        } else if (text.startsWith('/fire ')) {
            event = { type: 'fire', content: text.slice(6).trim(), timestamp };
        } else if (text.startsWith('/context ')) {
            event = { type: 'context', content: text.slice(9).trim(), timestamp };
        } else {
            // Any other message = directive from the boss
            event = { type: 'directive', content: text, timestamp };
        }

        this.emit(event);

        // Acknowledge receipt
        await this.sendToHermes(`✓ Received: ${event.type}`);
    }

    private emit(event: BridgeEvent): void {
        const handlers = this.eventHandlers.get(event.type) || [];
        const allHandlers = this.eventHandlers.get('*') || [];
        for (const handler of [...handlers, ...allHandlers]) {
            try {
                handler(event);
            } catch (err) {
                console.error('[TelegramBridge] Handler error:', err);
            }
        }
    }

    private async processQueue(): Promise<void> {
        this.isProcessing = true;
        while (this.messageQueue.length > 0) {
            const text = this.messageQueue.shift()!;
            try {
                await this.apiCall('sendMessage', {
                    chat_id: this.config.hermesChatId,
                    text,
                    parse_mode: 'Markdown'
                });
            } catch (err) {
                // Retry without markdown if parse fails
                try {
                    await this.apiCall('sendMessage', {
                        chat_id: this.config.hermesChatId,
                        text
                    });
                } catch (err2) {
                    console.error('[TelegramBridge] Send failed:', err2);
                }
            }
            await this.sleep(100); // Rate limit protection
        }
        this.isProcessing = false;
    }

    private async apiCall(method: string, params?: any): Promise<any> {
        const url = `https://api.telegram.org/bot${this.config.botToken}/${method}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: params ? JSON.stringify(params) : undefined
        });
        return res.json();
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
