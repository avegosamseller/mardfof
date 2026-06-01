import { exec } from 'child_process';

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
}

export class ToolExecutor {
    async execute(toolName: string, params: any): Promise<ToolResult> {
        switch (toolName) {
            case 'code_execute':
                return this.executeCode(params.code, params.language || 'javascript');
            case 'web_search':
                return this.webSearch(params.query);
            case 'write_note':
                return this.writeNote(params.content);
            case 'read_file':
                return this.readFile(params.path);
            default:
                return { success: false, output: '', error: `Unknown tool: ${toolName}` };
        }
    }

    private executeCode(code: string, language: string): Promise<ToolResult> {
        return new Promise((resolve) => {
            if (language !== 'javascript' && language !== 'js') {
                resolve({ success: false, output: '', error: 'Only JavaScript is supported.' });
                return;
            }

            const wrappedCode = `
                const __timeout = setTimeout(() => { process.exit(1); }, 5000);
                try {
                    const result = (function() { ${code} })();
                    if (result !== undefined) console.log(JSON.stringify(result));
                    clearTimeout(__timeout);
                } catch(e) {
                    console.error(e.message);
                    clearTimeout(__timeout);
                    process.exit(1);
                }
            `;

            exec(`node -e "${wrappedCode.replace(/"/g, '\\"')}"`, { timeout: 6000 }, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, output: stderr || error.message, error: error.message });
                } else {
                    resolve({ success: true, output: stdout.trim() });
                }
            });
        });
    }

    private async webSearch(query: string): Promise<ToolResult> {
        try {
            const encoded = encodeURIComponent(query);
            const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1`);
            const data = await res.json();

            const abstract = data.Abstract || data.AbstractText || '';
            const relatedTopics = (data.RelatedTopics || []).slice(0, 3).map((t: any) => t.Text || '').join('; ');

            const output = abstract
                ? `Result: ${abstract}`
                : relatedTopics
                    ? `Related: ${relatedTopics}`
                    : `No direct results for "${query}".`;

            return { success: true, output };
        } catch (e: any) {
            return { success: false, output: '', error: `Search failed: ${e.message}` };
        }
    }

    private async writeNote(content: string): Promise<ToolResult> {
        console.log(`[ToolExecutor] Note: ${content}`);
        return { success: true, output: `Note saved: "${content.slice(0, 50)}..."` };
    }

    private async readFile(path: string): Promise<ToolResult> {
        const { readFile } = await import('fs/promises');
        try {
            if (path.includes('..') || path.startsWith('/')) {
                return { success: false, output: '', error: 'Path traversal not allowed.' };
            }
            const content = await readFile(path, 'utf-8');
            return { success: true, output: content.slice(0, 500) };
        } catch (e: any) {
            return { success: false, output: '', error: e.message };
        }
    }
}
