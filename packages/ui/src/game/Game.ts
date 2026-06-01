import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { OfficeState, AgentState } from './schema';
import { eventBus } from '../events';

let activeRoom: Colyseus.Room<OfficeState> | undefined;

export function getColyseusRoom() {
    return activeRoom;
}

function resolveWsEndpoint(): string {
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.hostname}:3000`;
    }
    return 'ws://localhost:3000';
}


export class OfficeScene extends Phaser.Scene {
    private agentSprites: Map<string, Phaser.GameObjects.Container> = new Map();
    private statusText!: Phaser.GameObjects.Text;
    private followTarget: Phaser.GameObjects.Container | null = null;
    private gridSize = 40 * 16;
    private heldMoveKeys: Set<string> = new Set();

    constructor() {
        super('OfficeScene');
    }

    preload() {
        // Generate simple colored rectangles as placeholder sprites
    }

    create() {
        this.statusText = this.add.text(10, 10, 'Connecting...', { color: '#ffffaa', fontSize: '14px' });
        this.statusText.setScrollFactor(0).setDepth(100);

        const g = this.add.graphics();
        const gridSize = this.gridSize;

        // Floor
        g.fillStyle(0x2d2d3d, 1);
        g.fillRect(0, 0, gridSize, gridSize);
        g.fillStyle(0x33334a, 1);
        g.fillRect(16, 16, gridSize - 32, gridSize - 32);

        // Meeting room
        g.fillStyle(0x352a45, 1);
        g.fillRect(32, 32, 200, 160);
        g.lineStyle(3, 0x6c5ce7, 0.9);
        g.strokeRect(32, 32, 200, 160);

        // Collab area
        g.fillStyle(0x3d3025, 1);
        g.fillRect(280, 32, 200, 160);
        g.lineStyle(3, 0xe17055, 0.9);
        g.strokeRect(280, 32, 200, 160);


        // Coffee area
        for (let tx = 0; tx < 11; tx++) {
            for (let ty = 0; ty < 11; ty++) {
                g.fillStyle((tx + ty) % 2 === 0 ? 0x2a3a2a : 0x253025, 1);
                g.fillRect(350 + tx * 16, 350 + ty * 16, 16, 16);
            }
        }
        g.lineStyle(2, 0x00b894, 0.7);
        g.strokeRect(350, 350, 176, 176);

        // Labels
        this.add.text(132, 46, 'Meeting Room', { fontSize: '10px', color: '#b8a9d4' }).setOrigin(0.5);
        this.add.text(380, 46, 'Collab Area', { fontSize: '10px', color: '#e8a87c' }).setOrigin(0.5);
        this.add.text(438, 364, 'Coffee & Pantry', { fontSize: '10px', color: '#7fcdaa' }).setOrigin(0.5);

        // Meeting table
        g.fillStyle(0x6d4c2e, 1);
        g.fillRect(72, 80, 120, 60);

        // Work desks
        const drawDesk = (x: number, y: number, label: string) => {
            g.fillStyle(0x5a3e28, 1);
            g.fillRect(x, y, 56, 28);
            g.fillStyle(0x6d4c2e, 1);
            g.fillRect(x + 2, y + 2, 52, 24);
            g.fillStyle(0x2d3436, 1);
            g.fillRect(x + 6, y + 3, 22, 14);
            g.fillStyle(0x74b9ff, 1);
            g.fillRect(x + 8, y + 5, 18, 10);
            this.add.text(x + 28, y - 6, label, { fontSize: '8px', color: '#a0a0c0' }).setOrigin(0.5);
        };
        drawDesk(64, 240, "Alice's Desk");
        drawDesk(64, 320, "Bob's Desk");
        drawDesk(64, 400, "Vacant");


        // Coffee machine & counter
        g.fillStyle(0x5a3e28, 1);
        g.fillRect(370, 380, 80, 20);
        g.fillStyle(0x2d3436, 1);
        g.fillRect(380, 370, 20, 24);
        g.fillStyle(0xd63031, 1);
        g.fillCircle(390, 390, 2);

        // Plants
        const drawPlant = (px: number, py: number) => {
            g.fillStyle(0x8b4513, 1);
            g.fillRect(px - 5, py, 10, 8);
            g.fillStyle(0x27ae60, 1);
            g.fillCircle(px, py - 4, 6);
            g.fillStyle(0x2ecc71, 1);
            g.fillCircle(px - 3, py - 6, 4);
            g.fillCircle(px + 4, py - 5, 4);
        };
        drawPlant(24, 210);
        drawPlant(140, 210);
        drawPlant(530, 380);

        // Bookshelf
        g.fillStyle(0x5a3e28, 1);
        g.fillRect(540, 50, 40, 80);
        const bookColors = [0xd63031, 0x0984e3, 0xfdcb6e, 0x00b894, 0x6c5ce7];
        for (let b = 0; b < 5; b++) {
            g.fillStyle(bookColors[b], 1);
            g.fillRect(544 + b * 7, 54, 5, 14);
        }

        // Grid lines (faint)
        g.lineStyle(1, 0x444466, 0.12);
        g.beginPath();
        for (let i = 0; i <= gridSize; i += 16) {
            g.moveTo(i, 0); g.lineTo(i, gridSize);
            g.moveTo(0, i); g.lineTo(gridSize, i);
        }
        g.strokePath();

        // Camera
        this.cameras.main.setBackgroundColor('#16213e');
        this.cameras.main.setZoom(2);
        this.cameras.main.centerOn(gridSize / 2, gridSize / 2);
        this.cameras.main.setBounds(0, 0, gridSize, gridSize);

        // Keyboard
        this.setupKeyboard();
        this.connectToServer();
    }


    private setupKeyboard() {
        const toDir = (key: string): string | null => {
            const k = key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') return 'left';
            if (k === 'arrowright' || k === 'd') return 'right';
            if (k === 'arrowup' || k === 'w') return 'up';
            if (k === 'arrowdown' || k === 's') return 'down';
            return null;
        };
        window.addEventListener('keydown', (e) => {
            const active = document.activeElement as HTMLElement;
            if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
            const dir = toDir(e.key);
            if (dir) { this.heldMoveKeys.add(dir); e.preventDefault(); }
        });
        window.addEventListener('keyup', (e) => {
            const dir = toDir(e.key);
            if (dir) this.heldMoveKeys.delete(dir);
        });
        window.addEventListener('blur', () => this.heldMoveKeys.clear());

        this.input.on('wheel', (_p: any, _o: any, _dx: number, dy: number) => {
            const z = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 1, 3);
            this.cameras.main.setZoom(z);
        });
    }

    async connectToServer() {
        try {
            const wsEndpoint = resolveWsEndpoint();
            this.statusText.setText(`Connecting to ${wsEndpoint}...`);
            const client = new Colyseus.Client(wsEndpoint);
            const room = await client.joinOrCreate('office');
            this.statusText.setText('Connected!').setColor('#00ff00');

            room.onStateChange.once((state: any) => {
                activeRoom = room as Colyseus.Room<OfficeState>;

                room.onMessage('chat', (msg: any) => {
                    eventBus.dispatchEvent(new CustomEvent('chat-message', { detail: msg }));
                });


                state.agents.onAdd((agent: AgentState, sessionId: string) => {
                    const container = this.add.container(agent.x * 16, agent.y * 16);

                    // Agent body (colored rectangle)
                    const colors: Record<string, number> = { alice: 0x6c5ce7, bob: 0x00b894 };
                    const color = colors[agent.id] || 0xe17055;
                    const body = this.add.rectangle(0, -8, 14, 28, color);
                    const head = this.add.circle(0, -24, 7, 0xffeaa7);

                    // Thought bubble
                    const thought = this.add.text(0, -42, '', {
                        fontSize: '8px', color: '#e0e0e0',
                        backgroundColor: '#1a1a3eee',
                        padding: { x: 4, y: 3 },
                        wordWrap: { width: 120 }
                    }).setOrigin(0.5, 1).setVisible(false);

                    // Emote bubble
                    const emote = this.add.text(10, -30, '', { fontSize: '12px' }).setOrigin(0.5).setVisible(false);

                    // Name label
                    const label = this.add.text(0, 10, agent.name, {
                        fontSize: '9px', color: '#ffffff',
                        backgroundColor: '#00000088', padding: { x: 2, y: 1 }
                    }).setOrigin(0.5, 0);

                    container.add([body, head, thought, emote, label]);
                    container.setSize(28, 44).setInteractive();
                    this.agentSprites.set(sessionId, container);

                    // Click to follow
                    container.on('pointerdown', () => {
                        this.followTarget = this.followTarget === container ? null : container;
                    });


                    let lastAction = '';
                    agent.onChange(() => {
                        this.tweens.add({
                            targets: container,
                            x: agent.x * 16,
                            y: agent.y * 16,
                            duration: 100
                        });

                        // Emote
                        const emoteMap: Record<string, string> = {
                            'work': '💻', 'talk': '💬', 'idle': '😌', 'use_tool': '🔧', 'move': '🚶', 'think': '💡'
                        };
                        const em = emoteMap[agent.action] || '';
                        if (em && agent.action !== lastAction) {
                            emote.setText(em).setVisible(true);
                            this.time.delayedCall(3000, () => emote.setVisible(false));
                        }

                        // Thought
                        if (agent.thought) {
                            thought.setText(agent.thought).setVisible(true);
                            this.time.delayedCall(6000, () => thought.setVisible(false));
                        }

                        // Activity log
                        if (agent.action !== lastAction) {
                            eventBus.dispatchEvent(new CustomEvent('activity-log', {
                                detail: { agent: agent.name, action: agent.action, thought: agent.thought, time: new Date().toLocaleTimeString() }
                            }));
                        }
                        lastAction = agent.action;
                    });
                });

                state.agents.onRemove((_agent: AgentState, sessionId: string) => {
                    const sprite = this.agentSprites.get(sessionId);
                    if (sprite) { sprite.destroy(); this.agentSprites.delete(sessionId); }
                });
            });
        } catch (e) {
            console.error(e);
            this.statusText.setText('Connection failed!').setColor('#ffaaaa');
        }
    }


    update() {
        const speed = 5;
        if (this.heldMoveKeys.size > 0) {
            this.followTarget = null;
            if (this.heldMoveKeys.has('left')) this.cameras.main.scrollX -= speed;
            if (this.heldMoveKeys.has('right')) this.cameras.main.scrollX += speed;
            if (this.heldMoveKeys.has('up')) this.cameras.main.scrollY -= speed;
            if (this.heldMoveKeys.has('down')) this.cameras.main.scrollY += speed;
        }
        if (this.followTarget) {
            const cam = this.cameras.main;
            const tx = this.followTarget.x - cam.width / (2 * cam.zoom);
            const ty = this.followTarget.y - cam.height / (2 * cam.zoom);
            cam.scrollX += (tx - cam.scrollX) * 0.08;
            cam.scrollY += (ty - cam.scrollY) * 0.08;
        }
        const cam = this.cameras.main;
        const maxX = Math.max(0, this.gridSize - cam.width / cam.zoom);
        const maxY = Math.max(0, this.gridSize - cam.height / cam.zoom);
        cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, maxX);
        cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, maxY);
    }
}

export function setupPhaser(parentId: string) {
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: parentId,
        width: window.innerWidth,
        height: window.innerHeight,
        scene: [OfficeScene],
        pixelArt: true,
        scale: { mode: Phaser.Scale.RESIZE },
        input: { keyboard: { capture: [] } }
    };
    return new Phaser.Game(config);
}
