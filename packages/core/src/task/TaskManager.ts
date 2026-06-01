export interface Task {
    id: string;
    title: string;
    description: string;
    type: 'coding' | 'writing' | 'research' | 'meeting' | 'review' | 'custom';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimatedDuration: number;
    requiredSkills: string[];
    dependencies: string[];
    creator?: string;
    assignee?: string;
    status: 'pending' | 'in_progress' | 'blocked' | 'completed';
}

export class TaskManager {
    private tasks: Map<string, Task> = new Map();

    private generateId(): string {
        return Math.random().toString(36).substring(2, 9);
    }

    public createTask(task: Omit<Task, 'id' | 'status'>): Task {
        const newTask: Task = { ...task, id: this.generateId(), status: 'pending' };
        this.tasks.set(newTask.id, newTask);
        return newTask;
    }

    public assignTask(taskId: string, agentId: string): void {
        const task = this.tasks.get(taskId);
        if (task) {
            task.assignee = agentId;
            if (task.status === 'pending') task.status = 'in_progress';
        }
    }

    public getAgentQueue(agentId: string): Task[] {
        return Array.from(this.tasks.values())
            .filter(t => t.assignee === agentId)
            .sort((a, b) => {
                const order = { urgent: 3, high: 2, medium: 1, low: 0 };
                return order[b.priority] - order[a.priority];
            });
    }

    public updateTaskStatus(taskId: string, status: Task['status']): void {
        const task = this.tasks.get(taskId);
        if (task) task.status = status;
    }

    public getTask(taskId: string): Task | undefined {
        return this.tasks.get(taskId);
    }
}
