/**
 * AnthropicProvider — Adapter LLM para Anthropic Claude.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ILLMProvider } from './ILLMProvider';

export class AnthropicProvider implements ILLMProvider {
    readonly name = 'anthropic';
    readonly defaultModel: string;

    constructor() {
        this.defaultModel = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-5';
    }

    isConfigured(): boolean {
        return !!process.env.ANTHROPIC_API_KEY;
    }

    buildChatModel(model: string, temperature: number): ChatAnthropic {
        return new ChatAnthropic({
            model,
            temperature,
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async listModels(): Promise<string[]> {
        // Anthropic não tem endpoint público de listagem — lista estática dos modelos atuais
        return [
            'claude-opus-4-5',
            'claude-sonnet-4-5',
            'claude-haiku-3-5',
        ];
    }

    async embed(_text: string): Promise<number[]> {
        // Anthropic não oferece API de embeddings
        return [];
    }
}
