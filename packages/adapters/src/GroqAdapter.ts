import { InferenceAdapter, CompletionRequest, CompletionResponse } from '@agent-office/core';

/**
 * GroqAdapter - Dedicated adapter for Groq's ultra-fast inference API.
 * 
 * Groq provides OpenAI-compatible endpoints with extremely low latency
 * thanks to their custom LPU (Language Processing Unit) hardware.
 * 
 * Supported models: llama-3.3-70b-versatile, llama-3.1-8b-instant, 
 * mixtral-8x7b-32768, gemma2-9b-it, etc.
 * 
 * Reference: https://console.groq.com/docs/api-reference
 */
export class GroqAdapter implements InferenceAdapter {
    public readonly provider = 'groq';
    public readonly isLocal = false;

    private baseUrl: string;
    private apiKey: string;
    private rateLimitRemaining: number = -1;
    private rateLimitReset: number = 0;
    private retryAfter: number = 0;

    constructor(apiKey: string, baseUrl: string = 'https://api.groq.com/openai/v1') {
        if (!apiKey) {
            throw new Error('Groq API key is required. Get one at https://console.groq.com');
        }
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    /**
     * Send a chat completion request to Groq.
     * Handles rate limiting, retries, and Groq-specific response parsing.
     */
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        // Respect rate limits
        await this.waitForRateLimit();

        const start = Date.now();

        const tools = request.tools ? request.tools.map(t => ({
            type: "function" as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters || {}
            }
        })) : undefined;

        const body: any = {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens || 1024,
            stream: false,
        };

        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = 'auto';
        }

        const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        // Track rate limit headers from Groq
        this.parseRateLimitHeaders(response.headers);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Groq API Error [${response.status}]: ${errorBody}`);
        }

        const data = await response.json();
        const latency = Date.now() - start;
        const message = data.choices?.[0]?.message;

        if (!message) {
            throw new Error('Groq returned empty response');
        }

        let toolCalls;
        if (message.tool_calls && message.tool_calls.length > 0) {
            toolCalls = message.tool_calls.map((tc: any) => ({
                name: tc.function.name,
                params: this.safeParseJSON(tc.function.arguments)
            }));
        }

        return {
            content: message.content || '',
            toolCalls,
            usage: {
                prompt: data.usage?.prompt_tokens || 0,
                completion: data.usage?.completion_tokens || 0
            },
            latency
        };
    }

    /**
     * Stream responses from Groq using Server-Sent Events (SSE).
     */
    async *stream(request: CompletionRequest): AsyncIterable<string> {
        await this.waitForRateLimit();

        const body: any = {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens || 1024,
            stream: true,
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Groq Stream Error [${response.status}]: ${errorBody}`);
        }

        this.parseRateLimitHeaders(response.headers);

        if (!response.body) {
            throw new Error('No response body for stream');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') return;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        yield delta;
                    }
                } catch {
                    // Skip malformed chunks
                }
            }
        }
    }

    /**
     * Fetch with automatic retry on rate limit (429) errors.
     * Groq has aggressive rate limits on free tier.
     */
    private async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await fetch(url, options);

            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                const waitMs = retryAfter
                    ? parseInt(retryAfter) * 1000
                    : Math.min(1000 * Math.pow(2, attempt), 30000);

                console.warn(`[GroqAdapter] Rate limited. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
                await this.sleep(waitMs);
                continue;
            }

            return response;
        }

        throw new Error('[GroqAdapter] Max retries exceeded due to rate limiting');
    }

    /**
     * Parse Groq's rate limit response headers.
     * Headers: x-ratelimit-remaining-requests, x-ratelimit-remaining-tokens, 
     *          x-ratelimit-reset-requests, x-ratelimit-reset-tokens
     */
    private parseRateLimitHeaders(headers: Headers): void {
        const remaining = headers.get('x-ratelimit-remaining-requests');
        const reset = headers.get('x-ratelimit-reset-requests');

        if (remaining !== null) {
            this.rateLimitRemaining = parseInt(remaining);
        }
        if (reset !== null) {
            // Groq returns reset time in various formats (e.g., "1s", "2m30s", ISO date)
            this.rateLimitReset = this.parseResetTime(reset);
        }
    }

    /**
     * Wait if we're approaching rate limits.
     */
    private async waitForRateLimit(): Promise<void> {
        if (this.rateLimitRemaining === 0 && this.rateLimitReset > 0) {
            const waitMs = Math.max(this.rateLimitReset - Date.now(), 0);
            if (waitMs > 0) {
                console.warn(`[GroqAdapter] Rate limit reached. Waiting ${waitMs}ms...`);
                await this.sleep(waitMs);
            }
        }
    }

    /**
     * Parse Groq's reset time format (e.g., "1s", "2m30s", or milliseconds).
     */
    private parseResetTime(value: string): number {
        // Try as milliseconds/timestamp
        const num = Number(value);
        if (!isNaN(num) && num > 1000000000) {
            return num * 1000; // Unix timestamp in seconds
        }

        // Parse duration format like "1s", "2m30s", "500ms"
        let totalMs = 0;
        const minuteMatch = value.match(/(\d+)m/);
        const secondMatch = value.match(/(\d+(?:\.\d+)?)s/);
        const msMatch = value.match(/(\d+)ms/);

        if (minuteMatch) totalMs += parseInt(minuteMatch[1]) * 60000;
        if (secondMatch && !msMatch) totalMs += parseFloat(secondMatch[1]) * 1000;
        if (msMatch) totalMs += parseInt(msMatch[1]);

        return Date.now() + totalMs;
    }

    private safeParseJSON(str: string): any {
        try {
            return JSON.parse(str);
        } catch {
            return str;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
