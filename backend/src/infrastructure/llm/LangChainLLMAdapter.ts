/**
 * LangChainLLMAdapter — Implementação de ILLMPort usando LangChain.
 *
 * Usa o LLMProviderRegistry para selecionar o provedor ativo e delega
 * a construção do modelo para o ILLMProvider correspondente.
 *
 * Arquitetura (Registry Pattern):
 *
 *   LangChainLLMAdapter   → implementa ILLMPort (contrato do domínio)
 *   LLMProviderRegistry   → seleciona o provedor ativo
 *   ILLMProvider          → contrato de cada provedor
 *   OpenAIProvider        → implementação OpenAI/Azure
 *   AnthropicProvider     → implementação Anthropic Claude
 *   GeminiProvider        → implementação Google Gemini
 *   OllamaProvider        → implementação Ollama (local)
 *
 * Para adicionar um novo provedor:
 *   1. Crie `providers/MeuProvider.ts` implementando ILLMProvider
 *   2. Registre-o em `createDefaultRegistry()` abaixo
 *   Nenhuma outra mudança necessária.
 */

import { injectable } from 'tsyringe';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '../../config/logger';
import {
    ILLMPort,
    LLMMessage,
    LLMResponse,
    LLMCallOptions,
    ToolDefinition,
    ToolCall,
} from '../../domain/agent/ports/ILLMPort';
import { LLMProviderRegistry } from './LLMProviderRegistry';
import { OpenAIProvider, AzureOpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OllamaProvider } from './providers/OllamaProvider';

const log = logger.child({ module: 'llm-adapter' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractRetryDelayMs(err: unknown): number | null {
    try {
        const e = err as { errorDetails?: Array<{ '@type'?: string; retryDelay?: string }> };
        for (const detail of e?.errorDetails ?? []) {
            if (detail?.['@type']?.includes('RetryInfo') && detail?.retryDelay) {
                const seconds = parseFloat(String(detail.retryDelay).replace('s', ''));
                if (!isNaN(seconds)) return Math.ceil(seconds * 1000);
            }
        }
    } catch { /* ignore */ }
    return null;
}

/** Extrai texto de uma resposta LangChain (string ou ContentBlock[]). */
function extractText(content: AIMessage['content']): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((block: unknown) => {
                if (typeof block === 'string') return block;
                return (block as { text?: string })?.text ?? '';
            })
            .join('');
    }
    return String(content);
}

/**
 * Converte um ToolDefinition (JSON Schema) para uma tool LangChain com schema Zod.
 *
 * Suporta os tipos JSON Schema mais comuns: string, number, integer, boolean, array, object.
 * Tipos desconhecidos ou complexos (anyOf, $ref) são tratados como string.
 */
function buildLangChainTool(def: ToolDefinition): ReturnType<typeof tool> {
    const props = (def.parameters as Record<string, unknown>)?.properties as Record<string, { type?: string; description?: string; properties?: unknown; items?: unknown }> ?? {};
    const required: string[] = ((def.parameters as Record<string, unknown>)?.required as string[]) ?? [];

    const zodShape: Record<string, z.ZodTypeAny> = {};

    for (const [key, schema] of Object.entries(props)) {
        let field: z.ZodTypeAny;

        switch (schema.type) {
            case 'number':
            case 'integer':
                field = z.number();
                break;
            case 'boolean':
                field = z.boolean();
                break;
            case 'array':
                field = z.array(z.unknown());
                break;
            case 'object':
                field = z.record(z.unknown());
                break;
            default:
                field = z.string();
        }

        if (schema.description) field = field.describe(schema.description);
        if (!required.includes(key)) field = field.optional() as z.ZodTypeAny;
        zodShape[key] = field;
    }

    return tool(
        async (_args: unknown) => 'placeholder', // handler real está no AgentHarness
        {
            name: def.name,
            description: def.description,
            schema: z.object(zodShape),
        },
    ) as ReturnType<typeof tool>;
}

// ─── Registry padrão ─────────────────────────────────────────────────────────

/**
 * Cria o registry com todos os provedores disponíveis, na ordem de prioridade.
 * Exportado para permitir customização em testes.
 */
export function createDefaultRegistry(): LLMProviderRegistry {
    return new LLMProviderRegistry()
        .register(new OpenAIProvider())
        .register(new AnthropicProvider())
        .register(new AzureOpenAIProvider())
        .register(new GeminiProvider())
        .register(new OllamaProvider());
}

// ─── LangChainLLMAdapter ──────────────────────────────────────────────────────

@injectable()
export class LangChainLLMAdapter implements ILLMPort {
    private readonly registry: LLMProviderRegistry;

    constructor(registry?: LLMProviderRegistry) {
        this.registry = registry ?? createDefaultRegistry();
    }

    get providerName(): string {
        return this.registry.getActive().name;
    }

    get defaultModel(): string {
        return this.registry.getActive().defaultModel;
    }

    async listAvailableModels(): Promise<string[]> {
        return this.registry.getActive().listModels();
    }

    async chat(
        messages: LLMMessage[],
        model: string,
        options: LLMCallOptions = {},
    ): Promise<LLMResponse> {
        const provider = this.registry.getActive();
        const temperature = options.temperature ?? 0;
        const llm = provider.buildChatModel(model, temperature);

        // Vincula tools ao modelo se fornecidas
        const langchainTools = (options.tools ?? []).map(buildLangChainTool);
        const boundLLM = langchainTools.length > 0 ? llm.bindTools(langchainTools) : llm;

        // Converte mensagens para o formato LangChain
        const langchainMessages: BaseMessage[] = messages.map(msg => {
            switch (msg.role) {
                case 'system': return new SystemMessage(msg.content);
                case 'user': return new HumanMessage(msg.content);
                case 'tool': return new ToolMessage({ tool_call_id: msg.toolCallId ?? '', content: msg.content });
                default: return new AIMessage(msg.content);
            }
        });

        const response = await this.invokeWithRetry(boundLLM, langchainMessages, provider.name);

        const content = extractText(response.content);
        const toolCalls: ToolCall[] = ((response.tool_calls ?? []) as Array<{ id?: string; name: string; args?: Record<string, unknown> }>).map(tc => ({
            id: tc.id ?? '',
            name: tc.name,
            arguments: tc.args ?? {},
        }));

        const usageMeta = (response as unknown as { usage_metadata?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }).usage_metadata;

        return {
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            model,
            usage: usageMeta ? {
                promptTokens: usageMeta.input_tokens ?? 0,
                completionTokens: usageMeta.output_tokens ?? 0,
                totalTokens: usageMeta.total_tokens ?? 0,
            } : undefined,
        };
    }

    async embed(text: string): Promise<number[]> {
        return this.registry.getActive().embed(text);
    }

    // ─── Retry com backoff exponencial ──────────────────────────────────────────

    private async invokeWithRetry(
        llm: { invoke: (messages: BaseMessage[]) => Promise<AIMessage> },
        messages: BaseMessage[],
        providerName: string,
        maxRetries = 5,
    ): Promise<AIMessage> {
        for (let attempt = 0; ; attempt++) {
            try {
                return await llm.invoke(messages);
            } catch (err: unknown) {
                const e = err as { status?: number; message?: string };
                const is429 =
                    e?.status === 429 ||
                    String(e?.message).includes('429') ||
                    String(e?.message).toLowerCase().includes('rate limit');

                if (!is429 || attempt >= maxRetries) throw err;

                const delayMs = extractRetryDelayMs(err) ?? Math.min(60_000, 10_000 * (attempt + 1));
                log.warn({ attempt: attempt + 1, maxRetries, delayMs, provider: providerName }, 'Rate limited — aguardando');
                await sleep(delayMs + 1_000);
            }
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: LangChainLLMAdapter | null = null;

/** Retorna o singleton do adapter LLM. Instanciado na primeira chamada. */
export function getLLMAdapter(): LangChainLLMAdapter {
    if (!_instance) _instance = new LangChainLLMAdapter();
    return _instance;
}
