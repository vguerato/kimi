/**
 * ILLMProvider — Contrato para um provedor LLM individual.
 *
 * Cada provedor (OpenAI, Anthropic, Gemini, Ollama, Azure) implementa
 * esta interface. O LLMProviderRegistry seleciona o provedor ativo
 * com base nas variáveis de ambiente disponíveis.
 *
 * Separação de responsabilidades:
 *   ILLMProvider  → sabe como construir e invocar um modelo específico
 *   LLMProviderRegistry → sabe qual provedor usar e gerencia o ciclo de vida
 *   LangChainLLMAdapter → implementa ILLMPort usando o registry
 */

import { BaseMessage } from '@langchain/core/messages';

export interface ILLMProvider {
    /** Nome único do provedor (ex: 'openai', 'anthropic', 'gemini'). */
    readonly name: string;

    /** Modelo padrão deste provedor. */
    readonly defaultModel: string;

    /** Retorna true se este provedor está configurado (env vars presentes). */
    isConfigured(): boolean;

    /**
     * Constrói uma instância do modelo LangChain pronta para uso.
     * Chamado a cada invocação — LangChain gerencia o estado interno.
     */
    buildChatModel(model: string, temperature: number): any;

    /**
     * Lista os modelos disponíveis neste provedor.
     * Pode fazer uma chamada de API ou retornar uma lista estática.
     */
    listModels(): Promise<string[]>;

    /**
     * Gera um embedding vetorial para um texto.
     * Retorna array vazio se o provedor não suportar embeddings.
     */
    embed(text: string): Promise<number[]>;
}
