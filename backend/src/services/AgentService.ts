import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, ToolMessage, AIMessage } from "@langchain/core/messages";
import { exec } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { DelegateSubtaskData } from "../workers/TaskWorker";

const execAsync = util.promisify(exec);

/**
 * Fetches the list of available Gemini models via the official @google/genai SDK.
 * Filters to models that support generateContent and whose names start with "gemini-".
 * Falls back to the configured default model if the call fails.
 */
async function fetchAvailableModels(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!apiKey) {
    console.warn('[AgentService] GEMINI_API_KEY not set — cannot fetch model list.');
    return [defaultModel];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const models: string[] = [];

    // ai.models.list() returns a Promise<Pager> — await it first, then iterate
    const pager = await ai.models.list();
    for await (const model of pager) {
      const name: string = ((model as any).name || '').replace(/^models\//, '');
      const methods: string[] = (model as any).supportedGenerationMethods || [];

      if (name.startsWith('gemini-') && methods.includes('generateContent')) {
        models.push(name);
      }
    }

    if (models.length === 0) {
      console.warn('[AgentService] No generateContent-capable Gemini models returned by SDK.');
      return [defaultModel];
    }

    console.log(`[AgentService] Fetched ${models.length} available model(s) via @google/genai SDK: ${models.join(', ')}`);
    return models;
  } catch (err: any) {
    console.error('[AgentService] Failed to fetch model list via SDK:', err?.message || err);
    return [defaultModel];
  }
}

/**
 * Sleeps for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts the retry delay in milliseconds from a 429 error, if present.
 * Gemini API returns retryDelay as e.g. "45s" or "15.5s" in errorDetails.
 */
function extractRetryDelayMs(err: any): number | null {
  try {
    const details: any[] = err?.errorDetails || [];
    for (const detail of details) {
      if (detail?.['@type']?.includes('RetryInfo') && detail?.retryDelay) {
        const seconds = parseFloat(String(detail.retryDelay).replace('s', ''));
        if (!isNaN(seconds)) return Math.ceil(seconds * 1000);
      }
    }
  } catch {}
  return null;
}

/**
 * Invokes the LLM with automatic retry on 429 rate-limit errors,
 * respecting the retryDelay returned by the API.
 */
async function invokeWithRetry(llm: any, messages: any[], maxRetries = 5): Promise<AIMessage> {
  let attempt = 0;
  while (true) {
    try {
      return await llm.invoke(messages);
    } catch (err: any) {
      const is429 = err?.status === 429 || String(err?.message).includes('429');
      if (!is429 || attempt >= maxRetries) throw err;

      attempt++;
      const delayMs = extractRetryDelayMs(err) ?? Math.min(60000, 10000 * attempt);
      console.warn(`[AgentService] Rate limited (429). Retrying in ${delayMs / 1000}s (attempt ${attempt}/${maxRetries})...`);
      await sleep(delayMs + 1000); // +1s buffer
    }
  }
}

export class AgentService {
  private repoPath: string;
  private taskData: DelegateSubtaskData;
  private llm: ChatGoogleGenerativeAI;

  constructor(repoPath: string, taskData: DelegateSubtaskData, model?: string) {
    this.repoPath = repoPath;
    this.taskData = taskData;
    
    const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    console.log(`[AgentService] Using model: ${selectedModel}`);

    this.llm = new ChatGoogleGenerativeAI({
      model: selectedModel,
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  /**
   * Fetches available models from the Google AI API, then consults the LLM
   * to determine the most appropriate one for the given task.
   * Returns the model name chosen by the LLM.
   */
  static async selectModelForTask(taskData: DelegateSubtaskData): Promise<string> {
    const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    try {
      console.log(`[AgentService] Fetching available models for task ${taskData.taskId}...`);
      const availableModels = await fetchAvailableModels();

      console.log(`[AgentService] Selecting best model for task ${taskData.taskId}...`);

      // Use the default/fast model just for the model-selection prompt
      const selectorLlm = new ChatGoogleGenerativeAI({
        model: defaultModel,
        temperature: 0,
        apiKey: process.env.GEMINI_API_KEY,
      });

      const prompt = `You are a task routing assistant. Based on the task below, choose the most appropriate AI model to execute it.

Available models:
${availableModels.map((m, i) => `${i + 1}. ${m}`).join('\n')}

General guidance:
- Prefer "flash" variants for simple, fast tasks (CRUD, boilerplate, small bug fixes).
- Prefer "pro" or "thinking" variants for complex tasks (architecture changes, intricate algorithms, deep refactoring).
- Choose the most capable model that is justified by the task complexity — avoid over-engineering.

Parent task context:
- Parent ID: ${taskData.parentId}
- Parent Title: ${taskData.parentTitle || '(not provided)'}
- Parent Description: ${taskData.parentDescription || '(not provided)'}

Sub-task to execute:
- ID: ${taskData.taskId}
- Title: ${taskData.title}
- Description: ${taskData.description || '(no description provided)'}

Respond with ONLY the model name, exactly as listed above. No explanation, no punctuation — just the model name.`;

      const response = await invokeWithRetry(selectorLlm, [new HumanMessage(prompt)]);
      const chosen = (typeof response.content === 'string' ? response.content : String(response.content)).trim();

      // Exact match
      if (availableModels.includes(chosen)) {
        console.log(`[AgentService] Model selected for task ${taskData.taskId}: ${chosen}`);
        return chosen;
      }

      // Partial match in case the LLM added extra text
      const matched = availableModels.find(m => chosen.includes(m) || m.includes(chosen));
      if (matched) {
        console.log(`[AgentService] Model selected (partial match) for task ${taskData.taskId}: ${matched}`);
        return matched;
      }

      console.warn(`[AgentService] LLM returned unknown model "${chosen}", falling back to default.`);
      return defaultModel;
    } catch (err) {
      console.error(`[AgentService] Model selection failed, using default:`, err);
      return defaultModel;
    }
  }

  private getTools() {
    return [
      tool(
        async ({ command }) => {
          try {
            const { stdout, stderr } = await execAsync(command, { cwd: this.repoPath });
            return stdout + (stderr ? `\nStderr: ${stderr}` : "");
          } catch (error: any) {
            return `Error executing command: ${error.message}`;
          }
        },
        {
          name: "execute_terminal_command",
          description: "Executes a bash command in the repository directory. Useful for finding files, reading files with 'cat', or running tests.",
          schema: z.object({ command: z.string().describe("The bash command to run") }),
        }
      ),
      tool(
        async ({ filePath, content }) => {
          try {
            const fullPath = path.join(this.repoPath, filePath.trim());
            fs.writeFileSync(fullPath, content);
            return `Successfully wrote to ${filePath}`;
          } catch (error: any) {
            return `Error writing file: ${error.message}`;
          }
        },
        {
          name: "write_file",
          description: "Writes content to a file.",
          schema: z.object({ 
            filePath: z.string().describe("The relative path of the file"),
            content: z.string().describe("The full content to write to the file")
          }),
        }
      )
    ];
  }

  async executeTask(): Promise<void> {
    console.log(`[AgentService] Starting AI execution for task ${this.taskData.taskId}`);
    
    const tools = this.getTools();
    const modelWithTools = this.llm.bindTools(tools);
    
    const messages: any[] = [
      new SystemMessage("You are an expert AI developer ('Kiro') powered by Gemini. You have full access to a terminal and file system in the repository directory. Your job is to complete the sub-task given to you. Use tools to read files, modify them, and test your code. When you are fully done and verified the code, return a final response."),
      new HumanMessage(
        `## Parent Task Context\n` +
        `Parent ID: ${this.taskData.parentId}\n` +
        `Parent Title: ${this.taskData.parentTitle || '(not provided)'}\n` +
        `Parent Description:\n${this.taskData.parentDescription || '(not provided)'}\n\n` +
        `## Sub-task to Implement\n` +
        `Task ID: ${this.taskData.taskId}\n` +
        `Title: ${this.taskData.title}\n` +
        `Description:\n${this.taskData.description || '(not provided)'}\n\n` +
        `You are currently in the repository folder. Use the parent task context to better understand the broader goal and ensure your implementation is consistent with it. Please execute this sub-task.`
      )
    ];

    let iterations = 0;
    while (iterations < 15) {
      iterations++;
      console.log(`[AgentService] Iteration ${iterations}...`);
      
      const response: AIMessage = await invokeWithRetry(modelWithTools, messages);
      messages.push(response);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        // Agent finished
        console.log(`[AgentService] AI task completed. Final response: ${response.content}`);
        break;
      }

      for (const toolCall of response.tool_calls) {
        console.log(`[AgentService] Executing tool: ${toolCall.name}`);
        const selectedTool = tools.find((t) => t.name === toolCall.name);
        if (selectedTool) {
          const toolResult = await (selectedTool as any).invoke(toolCall.args);
          messages.push(new ToolMessage({ tool_call_id: toolCall.id || '', content: String(toolResult) }));
        }
      }
    }

    console.log(`[AgentService] AI execution completed for task ${this.taskData.taskId}`);
  }
}
