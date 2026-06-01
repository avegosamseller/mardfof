import { Schema, MapSchema, type } from '@colyseus/schema';

export class AgentState extends Schema {
    @type('string') id: string = '';
    @type('string') name: string = '';
    @type('number') x: number = 0;
    @type('number') y: number = 0;
    @type('string') direction: string = 'down';
    @type('string') action: string = 'idle';
    @type('string') currentTask: string = '';
    @type('string') thought: string = '';
    @type('number') mood: number = 0.6;
    @type('number') reputation: number = 0.5;
    @type('number') riskLevel: number = 0.2;
    @type('number') momentum: number = 0.4;

    constructor(id?: string, name?: string) {
        super();
        if (id) this.id = id;
        if (name) this.name = name;
    }
}

export class OfficeState extends Schema {
    @type({ map: AgentState }) agents = new MapSchema<AgentState>();
    @type('string') officeTime: string = new Date().toISOString();
    @type('number') timeScale: number = 1;

    createAgent(id: string, name: string) {
        const agent = new AgentState(id, name);
        this.agents.set(id, agent);
    }

    removeAgent(id: string) {
        this.agents.delete(id);
    }
}
