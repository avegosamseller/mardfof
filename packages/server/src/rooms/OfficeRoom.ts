import { Room, Client } from 'colyseus';
import { OfficeState } from '../schema/OfficeState';
import { Agent, OfficeConfig, Office, ConversationMessage } from '@agent-office/core';
import { OllamaAdapter } from '@agent-office/adapters';
import { ToolExecutor } from '../tools/ToolExecutor';
import { MemoryStore } from '../memory/MemoryStore';

export class OfficeRoom extends Room<OfficeState> {
    private static activeRoom: OfficeRoom | null = null;
    maxClients = 100;
    private office!: Office;
    private demoTickCount = 0;
    private coreAgents: Map<string, Agent> = new Map();
    private thinkingLocks: Map<string, boolean> = new Map();
    private ollamaAdapter!: OllamaAdapter;
    private hireCount = 0;
    private toolExecutor = new ToolExecutor();
    private memoryStore!: MemoryStore;
    private sessionId = `session_${Date.now()}`;
    private currentLayout: any[] = [];


    private furnitureTargets: Record<string, { x: number; y: number }> = {
        'alice-desk': { x: 5, y: 18 },
        'bob-desk': { x: 5, y: 23 },
        'hire_0-desk': { x: 15, y: 18 },
        'hire_1-desk': { x: 15, y: 23 },
        'hire_2-desk': { x: 25, y: 18 },
        'hire_3-desk': { x: 25, y: 8 },
        'hire_4-desk': { x: 32, y: 18 },
    };

    static getActiveRoom(): OfficeRoom | null {
        return OfficeRoom.activeRoom;
    }

    async onCreate(options: any) {
        OfficeRoom.activeRoom = this;
        this.setState(new OfficeState());

        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const model = process.env.LLM_MODEL || 'hermes3:latest';
        this.ollamaAdapter = new OllamaAdapter(ollamaUrl);
        this.memoryStore = new MemoryStore(ollamaUrl);
        await this.memoryStore.initialize();


        const config: OfficeConfig = {
            name: options.name || 'Startup HQ',
            grid: { width: 40, height: 40, tileSize: 16 },
            rooms: [], furniture: [],
            spawnPoints: [{ x: 10, y: 10 }], zones: []
        };
        this.office = new Office(config);

        const setupCoreAgent = async (id: string, name: string, role: string, x: number, y: number) => {
            this.state.createAgent(id, name);
            const state = this.state.agents.get(id);
            if (state) { state.x = x; state.y = y; }

            const coreAgent = new Agent({
                id, name, role, avatar: 'sprite.png',
                inference: {
                    provider: 'ollama', model,
                    systemPrompt: `You are ${name}, a ${role} in a virtual office. Be social, do your work, and collaborate. Keep thoughts SHORT.`,
                },
                personality: {
                    traits: { openness: 0.8, conscientiousness: 0.9, extraversion: 0.6, agreeableness: 0.7, neuroticism: 0.1 },
                    communicationStyle: role === 'Engineer' ? 'technical' : 'casual',
                    workHours: { start: '09:00', end: '17:00' }, breakFrequency: 120
                },
                capabilities: [
                    { name: 'code_execute', description: 'Execute JavaScript code' },
                    { name: 'web_search', description: 'Search the web' },
                    { name: 'write_note', description: 'Write a note' },
                    { name: 'create_task', description: 'Create and assign tasks' },
                    { name: 'hire_agent', description: 'Hire a new team member' }
                ],
                memory: { shortTermLimit: 50 }
            });


            coreAgent.setInferenceAdapter(this.ollamaAdapter);
            await coreAgent.initialize();
            const previousMemories = await this.memoryStore.loadMemories(id, 20);
            if (previousMemories.length > 0) {
                coreAgent.loadMemories(previousMemories);
                console.log(`[${name}] Loaded ${previousMemories.length} memories`);
            }
            this.coreAgents.set(id, coreAgent);
            this.thinkingLocks.set(id, false);
        };

        await setupCoreAgent('alice', 'Alice', 'Engineer', 10, 10);
        await setupCoreAgent('bob', 'Bob', 'Product Manager', 20, 15);

        // Message handlers
        this.onMessage('chat', (client, message) => {
            this.broadcast('chat', { sender: 'User', text: message.text });
        });

        this.onMessage('assign-task', (client, message) => {
            const { title, agentId } = message;
            const targetId = agentId || this.autoAssignAgent();
            const agent = this.coreAgents.get(targetId);
            const agentState = this.state.agents.get(targetId);
            if (agent && agentState) {
                agent.currentTask = title;
                agentState.currentTask = title;
                this.memoryStore.createTask(title, targetId);
                this.broadcast('chat', { sender: 'System', text: `Task "${title}" assigned to ${agentState.name}` });
                this.broadcast('task-update', { agentId: targetId, agentName: agentState.name, task: title, status: 'in_progress' });
            }
        });


        this.onMessage('save-layout', async (client, message) => {
            const layout = Array.isArray(message.layout) ? message.layout : [];
            await this.memoryStore.saveLayout('default', JSON.stringify(layout));
            this.currentLayout = layout;
            this.broadcast('layout-sync', { name: 'default', layout: this.currentLayout });
        });

        this.setSimulationInterval((delta) => this.update(delta), 100);
    }

    private autoAssignAgent(): string {
        for (const [id, agent] of this.coreAgents) {
            if (!agent.currentTask) return id;
        }
        return 'alice';
    }

    async update(delta: number) {
        this.state.officeTime = new Date().toISOString();

        // Agent think cycle
        this.coreAgents.forEach((coreAgent, id) => {
            if (!this.thinkingLocks.get(id)) {
                this.thinkingLocks.set(id, true);
                const agentState = this.state.agents.get(id);
                if (!agentState) return;

                const nearbyAgents: { name: string; role: string; distance: number }[] = [];
                this.coreAgents.forEach((other, otherId) => {
                    if (otherId === id) return;
                    const otherState = this.state.agents.get(otherId);
                    if (otherState) {
                        const dist = Math.abs(agentState.x - otherState.x) + Math.abs(agentState.y - otherState.y);
                        nearbyAgents.push({ name: other.config.name, role: other.config.role, distance: dist });
                    }
                });


                coreAgent.think({
                    time: this.state.officeTime,
                    location: `${agentState.x},${agentState.y}`,
                    nearbyAgents,
                    currentTask: coreAgent.currentTask || null,
                    recentMessages: coreAgent.getUnreadMessages(),
                    memories: coreAgent.getRecentMemories(5)
                }).then(async (decision) => {
                    agentState.action = decision.action;
                    if (decision.thought) agentState.thought = decision.thought;

                    // Handle talk
                    if (decision.action === 'talk' && decision.message) {
                        const targetName = decision.target || '';
                        let targetId = '';
                        this.coreAgents.forEach((a, aId) => {
                            if (a.config.name.toLowerCase() === targetName.toLowerCase()) targetId = aId;
                        });
                        const targetAgent = this.coreAgents.get(targetId);
                        if (targetAgent) {
                            const msg: ConversationMessage = {
                                from: coreAgent.config.name,
                                to: targetAgent.config.name,
                                content: decision.message,
                                timestamp: this.state.officeTime
                            };
                            targetAgent.receiveMessage(msg);
                            this.broadcast('chat', { sender: coreAgent.config.name, text: `(to ${targetAgent.config.name}): ${decision.message}` });
                            await this.memoryStore.saveMemory(id, {
                                content: `Said to ${targetAgent.config.name}: "${decision.message}"`,
                                type: 'conversation', timestamp: this.state.officeTime, importance: 0.7
                            }, this.sessionId);
                        }
                        coreAgent.clearInbox();
                    }


                    // Handle tool execution
                    if (decision.action === 'use_tool' && decision.toolCall) {
                        if (decision.toolCall.name === 'create_task') {
                            const { title, assignee } = decision.toolCall.params;
                            const tId = assignee?.toLowerCase() || this.autoAssignAgent();
                            const tAgent = this.coreAgents.get(tId);
                            const tState = this.state.agents.get(tId);
                            if (tAgent && tState) {
                                tAgent.currentTask = title;
                                tState.currentTask = title;
                                await this.memoryStore.createTask(title, tId);
                                this.broadcast('chat', { sender: coreAgent.config.name, text: `Created task "${title}" for ${tAgent.config.name}` });
                                this.broadcast('task-update', { agentId: tId, agentName: tAgent.config.name, task: title, status: 'in_progress' });
                            }
                        } else if (decision.toolCall.name === 'hire_agent') {
                            await this.handleHire(coreAgent, decision.toolCall.params);
                        } else {
                            const result = await this.toolExecutor.execute(decision.toolCall.name, decision.toolCall.params);
                            this.broadcast('chat', { sender: coreAgent.config.name, text: `Used [${decision.toolCall.name}]: ${result.success ? result.output.slice(0, 100) : result.error}` });
                            coreAgent.addMemory({ content: `Tool ${decision.toolCall.name}: ${result.output.slice(0, 200)}`, type: 'task_result', timestamp: this.state.officeTime, importance: 0.8 });
                        }
                    }

                    if (Math.random() < 0.3) {
                        await this.memoryStore.saveMemories(id, coreAgent.memories.slice(-3), this.sessionId);
                    }
                    setTimeout(() => this.thinkingLocks.set(id, false), 15000);
                }).catch(err => {
                    console.error(`Agent ${id} think error:`, err);
                    setTimeout(() => this.thinkingLocks.set(id, false), 15000);
                });
            }
        });


        // Movement
        const BOUNDS = { minX: 2, maxX: 36, minY: 2, maxY: 36 };
        this.demoTickCount++;
        if (this.demoTickCount >= 5) {
            this.demoTickCount = 0;
            this.state.agents.forEach((agent, key) => {
                const deskKey = `${key}-desk`;
                const target = this.furnitureTargets[deskKey] || { x: 5, y: 18 };

                if (agent.action === 'talk') {
                    let closest: { x: number; y: number } | null = null;
                    let minDist = Infinity;
                    this.state.agents.forEach((other, otherKey) => {
                        if (otherKey === key) return;
                        const dist = Math.abs(agent.x - other.x) + Math.abs(agent.y - other.y);
                        if (dist < minDist) { minDist = dist; closest = { x: other.x, y: other.y + 2 }; }
                    });
                    if (closest && minDist > 2) {
                        const c = closest as { x: number; y: number };
                        if (agent.x < c.x) agent.x += 1;
                        else if (agent.x > c.x) agent.x -= 1;
                        else if (agent.y < c.y) agent.y += 1;
                        else if (agent.y > c.y) agent.y -= 1;
                        return;
                    }
                }

                if (agent.x < target.x) agent.x += 1;
                else if (agent.x > target.x) agent.x -= 1;
                else if (agent.y < target.y) agent.y += 1;
                else if (agent.y > target.y) agent.y -= 1;

                agent.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, agent.x));
                agent.y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, agent.y));
            });
        }
    }


    private async handleHire(hirer: Agent, params: any) {
        const model = process.env.LLM_MODEL || 'hermes3:latest';
        const names = ['Charlie', 'Diana', 'Eve', 'Frank', 'Grace'];
        const hireName = params.name || names[this.hireCount % 5];
        const hireRole = params.role || 'Intern';
        const hireId = `hire_${this.hireCount}`;

        if (this.hireCount >= 5 || this.coreAgents.has(hireId)) {
            this.broadcast('chat', { sender: 'Office', text: `Office is full! (Max 7 agents)` });
            return;
        }

        this.state.createAgent(hireId, hireName);
        const hireState = this.state.agents.get(hireId);
        if (hireState) { hireState.x = 20; hireState.y = 2; }

        const hireAgent = new Agent({
            id: hireId, name: hireName, role: hireRole, avatar: 'sprite.png',
            inference: {
                provider: 'ollama', model,
                systemPrompt: `You are ${hireName}, a ${hireRole} hired by ${hirer.config.name}. Be enthusiastic and helpful. Keep thoughts SHORT.`,
            },
            personality: {
                traits: { openness: 0.9, conscientiousness: 0.7, extraversion: 0.8, agreeableness: 0.9, neuroticism: 0.2 },
                communicationStyle: 'casual',
                workHours: { start: '09:00', end: '17:00' }, breakFrequency: 90
            },
            capabilities: [
                { name: 'code_execute', description: 'Execute JavaScript code' },
                { name: 'web_search', description: 'Search the web' },
                { name: 'write_note', description: 'Write a note' },
                { name: 'create_task', description: 'Create a task' }
            ],
            memory: { shortTermLimit: 50 }
        });

        hireAgent.setInferenceAdapter(this.ollamaAdapter);
        await hireAgent.initialize();
        this.coreAgents.set(hireId, hireAgent);
        this.thinkingLocks.set(hireId, false);
        this.hireCount++;

        this.broadcast('chat', { sender: 'Office', text: `${hirer.config.name} hired ${hireName} as ${hireRole}!` });
    }


    onJoin(client: Client) {
        console.log(client.sessionId, "joined!");
        this.memoryStore.getTasks().then(tasks => client.send('tasks-sync', tasks));
        client.send('layout-sync', { name: 'default', layout: this.currentLayout });
    }

    onLeave(client: Client) {
        console.log(client.sessionId, "left!");
    }

    async onDispose() {
        console.log("Room disposing... saving memories");
        OfficeRoom.activeRoom = null;
        for (const [id, agent] of this.coreAgents) {
            await this.memoryStore.saveMemories(id, agent.memories, this.sessionId);
        }
        await this.memoryStore.close();
    }
}
