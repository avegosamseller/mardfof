export interface Memory {
    id: string;
    agentId: string;
    type: 'conversation' | 'action' | 'achievement' | 'relationship';
    content: string;
    embedding?: number[];
    timestamp: Date;
    importance: number;
    associations: string[];
}

export class MemoryManager {
    private shortTerm: Memory[] = [];

    private generateId(): string {
        return Math.random().toString(36).substring(2, 9);
    }

    async add(memory: Omit<Memory, 'id'>): Promise<void> {
        const newMemory: Memory = { ...memory, id: this.generateId() };
        this.shortTerm.push(newMemory);
        if (this.shortTerm.length > 50) this.shortTerm.shift();
    }

    async recall(query: string, limit: number = 5): Promise<Memory[]> {
        return this.shortTerm
            .filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
            .slice(0, limit);
    }

    async recallRecent(limit: number): Promise<Memory[]> {
        return this.shortTerm.slice(Math.max(this.shortTerm.length - limit, 0));
    }
}
