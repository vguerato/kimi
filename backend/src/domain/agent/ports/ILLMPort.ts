/**
 * ILLMPort — Port para integração com modelos de linguagem.
 *
 * Abstrai completamente o provedor LLM (OpenAI, Anthropic, Gemini, Ollama, etc.).
 * O sistema nunca depende de um SDK específico — apenas desta interface.
 *
 * Implementações concretas vivem em infrastructure/llm/.
 */

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    /** Presente apenas em mensagens do tipo 'tool'. */
    toolCallId?: string;
    /** Nome da tool (presente em mensagens 'tool'). */
    toolName?: string;
}

export interface ToolDefinition {
    name: string;
    description: string;
    /** JSON Schema dos parâmetros da tool. */
    parameters: Record<string, unknown>;
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface LLMResponse {
    content: string;
    /** Tool calls solicitadas pelo modelo, se houver. */
    toolCalls?: ToolCall[];
    /** Tokens consumidos nesta chamada (para métricas de custo). */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** Nome do modelo que gerou a resposta. */
    model: string;
}

export interface LLMCallOptions {
    /** Temperatura (0 = determinístico, 1 = criativo). Padrão: 0. */
    temperature?: number;
    /** Máximo de tokens na resposta. */
    maxTokens?: number;
    /** Tools disponíveis para o modelo invocar. */
    tools?: ToolDefinition[];
}

export interface ILLMPort {
    /** Nome do provedor (para logging e seleção). */
    readonly providerName: string;

    /** Modelo padrão deste provedor. */
    readonly defaultModel: string;

    /**
     * Retorna a lista de modelos disponíveis neste provedor.
     * Usado para seleção dinâmica de modelo por complexidade.
     */
    listAvailableModels(): Promise<string[]>;

    /**
     * Envia uma conversa ao modelo e retorna a resposta.
     * Suporta tool calling nativo.
     */
    chat(
        messages: LLMMessage[],
        model: string,
        options?: LLMCallOptions,
    ): Promise<LLMResponse>;

    /**
     * Gera um embedding vetorial para um texto.
     * Usado pela camada de memória semântica.
     */
    embed(text: string): Promise<number[]>;
}
