export interface ToolDefinition {
    name: string;
    description: string;
    parameters?: any;
}

export interface InferenceConfig {
    provider: 'ollama' | 'openai' | 'groq' | 'custom';
    model: string;
    baseUrl?: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt: string;
    tools?: ToolDefinition[];
}

export interface PersonalityConfig {
    traits: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    };
    communicationStyle: 'formal' | 'casual' | 'technical' | 'creative';
    workHours: { start: string; end: string };
    breakFrequency: number;
}

export interface Capability {
    name: string;
    description: string;
}

export interface MemoryConfig {
    shortTermLimit?: number;
}

export interface AgentConfig {
    id: string;
    name: string;
    role: string;
    avatar: string;
    inference: InferenceConfig;
    personality: PersonalityConfig;
    capabilities: Capability[];
    memory: MemoryConfig;
}
