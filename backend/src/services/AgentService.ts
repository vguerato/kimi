import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { DelegateSubtaskData } from '../workers/TaskWorker';

const execAsync = util.promisify(exec);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractRetryDelayMs(err: any): number | null {
  try {
    const details: any[] = err?.errorDetails || [];
    for (const detail of details) {
      if (detail?.['@type']?.includes('RetryInfo') && detail?.retryDelay) {
        const seconds = parseFloat(String(detail.retryDelay).replace('s', ''));
        if (!isNaN(seconds)) return Math.ceil(seconds * 1000);
      }
    }
  } catch { }
  return null;
}

// ─── Model listing ────────────────────────────────────────────────────────────

async function fetchAvailableModels(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    console.warn('[AgentService] GEMINI_API_KEY not set — using default model.');
    return [defaultModel];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const items: any[] = [];

    for await (const model of await ai.models.list()) {
      items.push(model);
    }

    const models = items
      .filter(m => {
        const name: string = m.name || '';
        const actions: string[] = m.supportedActions || m.supportedGenerationMethods || [];
        return (
          name.includes('gemini-') &&
          (actions.includes('generateContent') || actions.includes('GENERATE_CONTENT'))
        );
      })
      .map(m => (m.name as string).replace(/^models\//, ''));

    if (models.length === 0) {
      console.warn(`[AgentService] No generateContent models found. Using default.`);
      return [defaultModel];
    }

    console.log(`[AgentService] Available models: ${models.join(', ')}`);
    return models;
  } catch (err: any) {
    console.error('[AgentService] Failed to list models:', err?.message || err);
    return [defaultModel];
  }
}

// ─── Model selector ───────────────────────────────────────────────────────────

export class AgentService {
  private repoPath: string;
  private taskData: DelegateSubtaskData;
  private ai: GoogleGenAI;
  private model: string;

  constructor(repoPath: string, taskData: DelegateSubtaskData, model?: string) {
    this.repoPath = repoPath;
    this.taskData = taskData;
    this.model = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    console.log(`[AgentService] Using model: ${this.model}`);
  }

  /** Select the best available model for the given task using the LLM itself. */
  static async selectModelForTask(taskData: DelegateSubtaskData): Promise<string> {
    const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    try {
      console.log(`[AgentService] Fetching available models for task ${taskData.taskId}...`);
      const availableModels = await fetchAvailableModels();

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      const prompt = `You are a task routing assistant. Select the most appropriate AI model for the task below.

Available models:
${availableModels.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Rules:
- Prefer "flash" variants for simple tasks (CRUD, boilerplate, small fixes).
- Prefer "pro" or higher variants for complex tasks (architecture, algorithms, deep refactoring).

Task:
- ID: ${taskData.taskId}
- Title: ${taskData.title}
- Description: ${taskData.description || '(none)'}

Reply with ONLY the exact model name, nothing else.`;

      const response = await ai.models.generateContent({
        model: defaultModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const chosen = (response.text ?? '').trim();
      const exact = availableModels.find(m => m === chosen);
      if (exact) return exact;

      const partial = availableModels.find(m => chosen.includes(m) || m.includes(chosen));
      if (partial) return partial;

      console.warn(`[AgentService] Model "${chosen}" not in list — using default.`);
      return defaultModel;
    } catch (err) {
      console.error(`[AgentService] Model selection failed:`, err);
      return defaultModel;
    }
  }

  // ─── Repository context ──────────────────────────────────────────────────

  private async shell(cmd: string, maxChars = 6000): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: this.repoPath });
      const out = (stdout + (stderr ? `\nSTDERR: ${stderr}` : '')).trim();
      return out.length > maxChars ? out.slice(0, maxChars) + '\n…(truncated)' : out;
    } catch (e: any) {
      return `(command failed: ${e.message})`;
    }
  }

  private readFile(relPath: string, maxChars = 4000): string {
    try {
      const abs = path.join(this.repoPath, relPath);
      if (!fs.existsSync(abs)) return '';
      const content = fs.readFileSync(abs, 'utf-8');
      return content.length > maxChars ? content.slice(0, maxChars) + '\n…(truncated)' : content;
    } catch {
      return '';
    }
  }

  private async gatherRepoContext(): Promise<string> {
    console.log(`[AgentService] Gathering repository context...`);
    const lines: string[] = ['## Repository Context\n'];

    const tree = await this.shell(
      'find . -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.next/*" -not -path "*/coverage/*" -maxdepth 4 | sort | head -120'
    );
    lines.push(`### Directory Structure\n\`\`\`\n${tree}\n\`\`\``);

    for (const manifest of ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml']) {
      const content = this.readFile(manifest);
      if (content) lines.push(`### ${manifest}\n\`\`\`\n${content}\n\`\`\``);
    }

    for (const readme of ['README.md', 'readme.md', 'README.txt']) {
      const content = this.readFile(readme, 3000);
      if (content) { lines.push(`### README\n${content}`); break; }
    }

    for (const entry of ['src/index.ts', 'src/main.ts', 'src/app.ts', 'src/server.ts', 'main.py', 'app.py', 'cmd/main.go']) {
      const content = this.readFile(entry);
      if (content) { lines.push(`### Entry point: ${entry}\n\`\`\`\n${content}\n\`\`\``); break; }
    }

    const testFiles = await this.shell(
      'find . -not -path "*/node_modules/*" \\( -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.js" -o -name "*_test.go" -o -name "test_*.py" \\) | head -5'
    );
    if (testFiles && !testFiles.startsWith('(command failed')) {
      for (const tf of testFiles.split('\n').slice(0, 2)) {
        const content = this.readFile(tf.replace(/^\.\//, ''), 3000);
        if (content) lines.push(`### Test example: ${tf}\n\`\`\`\n${content}\n\`\`\``);
      }
    }

    const gitLog = await this.shell('git log --oneline -10');
    if (gitLog) lines.push(`### Recent commits\n\`\`\`\n${gitLog}\n\`\`\``);

    const branch = await this.shell('git rev-parse --abbrev-ref HEAD');
    if (branch) lines.push(`### Current branch\n\`${branch.trim()}\``);

    const totalChars = lines.join('\n\n').length;
    console.log(`[AgentService] Context gathered (${totalChars} chars).`);
    return lines.join('\n\n');
  }

  // ─── Retry wrapper ────────────────────────────────────────────────────────

  private async callWithRetry(params: any): Promise<any> {
    let attempt = 0;
    const MAX_ATTEMPTS = 8;

    while (true) {
      try {
        return await this.ai.models.generateContent(params);
      } catch (err: any) {
        const status = err?.status ?? 0;
        const msg = String(err?.message ?? '');
        const is429 = status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        const is503 = status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE');

        if ((!is429 && !is503) || attempt >= MAX_ATTEMPTS) throw err;
        attempt++;
        const delayMs = is429
          ? (extractRetryDelayMs(err) ?? Math.min(60000, 10000 * attempt))
          : Math.min(60000, 5000 * Math.pow(2, attempt - 1));
        console.warn(`[AgentService] ${is429 ? '429 rate limit' : '503 unavailable'} — retrying in ${delayMs / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})...`);
        await sleep(delayMs);
      }
    }
  }

  // ─── Main execution (single-shot) ────────────────────────────────────────

  async executeTask(): Promise<void> {
    console.log(`[AgentService] Starting single-shot execution for task ${this.taskData.taskId}`);

    // 1. Gather repo context (reads filesystem locally — no API call)
    const repoContext = await this.gatherRepoContext();

    // 2. Build the prompt — ask for ALL changes in one structured JSON response
    const prompt = `You are Kiro, an expert AI software engineer. You will implement the task below in ONE response.

## Repository context
${repoContext}

## Task
- **ID:** ${this.taskData.taskId}
- **Branch:** ${this.taskData.branch}
- **Title:** ${this.taskData.title}
- **Description:** ${this.taskData.description || '(infer from title and codebase)'}

## Instructions
1. Analyze the repository context above carefully.
2. Identify EVERY file that needs to be created or modified to fully implement the task.
3. Output your complete implementation as JSON, following the schema exactly.

## Output schema (strict JSON, no markdown)
{
  "summary": "Brief description of what was implemented",
  "files": [
    {
      "path": "relative/path/from/repo/root.ts",
      "action": "create" | "modify",
      "content": "complete file content — no truncation, no placeholders"
    }
  ],
  "notes": "Optional: caveats, follow-up steps, or assumptions made"
}

Rules:
- "content" must be the FULL file content, ready to be written to disk as-is.
- Never use "// TODO", "// ...", or any placeholder. Write complete, working code.
- Follow the exact same style, patterns, and conventions as the existing codebase.
- Only include files that are directly required to implement this task.
- Do NOT include package.json changes unless you are adding a strictly necessary new package.`;

    // 3. Call the model — single shot, structured JSON output
    console.log(`[AgentService] Sending single-shot request to ${this.model}...`);
    const t0 = Date.now();

    const response = await this.callWithRetry({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[AgentService] Response received in ${elapsed}s`);

    // 4. Parse the JSON response
    let result: { summary: string; files: { path: string; action: string; content: string }[]; notes?: string };
    try {
      const raw = response.text ?? '';
      // Strip any accidental markdown fences the model might add
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      result = JSON.parse(cleaned);
    } catch (err: any) {
      throw new Error(`[AgentService] Failed to parse model JSON output: ${err.message}\nRaw: ${String(response.text).slice(0, 300)}`);
    }

    console.log(`[AgentService] Summary: ${result.summary}`);
    if (result.notes) console.log(`[AgentService] Notes: ${result.notes}`);

    // 5. Apply all file changes
    const files = result.files ?? [];
    console.log(`[AgentService] Applying ${files.length} file(s)...`);

    for (const file of files) {
      if (!file.path || !file.content) {
        console.warn(`[AgentService] Skipping invalid file entry: ${JSON.stringify(file).slice(0, 80)}`);
        continue;
      }
      const absPath = path.join(this.repoPath, file.path.replace(/^\/+/, ''));
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, file.content, 'utf-8');
      console.log(`[AgentService] ✓ ${file.action ?? 'write'}: ${file.path}`);
    }

    console.log(`[AgentService] All files written. Task ${this.taskData.taskId} complete.`);
  }
}

