/**
 * OllamaProvider — Adapter LLM para Ollama (modelos locais/self-hosted).
 *
 * Ativado quando OLLAMA_BASE_URL está definido.
 * Suporta qualquer modelo disponível na instância Ollama configurada.
 */

import { ChatOllama } from '@langchain/ollama';
import axios from 'axios';
import { ILLMProvider } from './ILLMProvider';

export class OllamaProvider implements ILLMProvider {
    readonly name = 'ollama';
    readonly defaultModel: string;

    constructor() {
        this.defaultModel = process.env.OLLAMA_MODEL ?? 'llama3.2';
    }

    isConfigured(): boolean {
        return !!process.env.OLLAMA_BASE_URL;
    }

    buildChatModel(model: string, temperature: number): ChatOllama {
        return new ChatOllama({
            model,
            temperature,
            baseUrl: process.env.OLLAMA_BASE_URL,
        });
    }

    async listModels(): Promise<string[]> {
        try {
            const { data } = await axios.get<{ models: Array<{ name: string }> }>(
                `${process.env.OLLAMA_BASE_URL}/api/tags`,
                { timeout: 5_000 },
            );
            return (data.models ?? []).map(m => m.name);
        } catch {
            return [this.defaultModel];
        }
    }

    async embed(_text: string): Promise<number[]> {
        // Ollama suporta embeddings mas requer configuração adicional
        return [];
    }
}
