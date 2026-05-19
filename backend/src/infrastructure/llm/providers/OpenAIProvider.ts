/**
 * OpenAIProvider — Adapter LLM para OpenAI e Azure OpenAI.
 *
 * Suporta dois modos:
 *   - OpenAI direto (OPENAI_API_KEY)
 *   - Azure OpenAI (AZURE_OPENAI_API_KEY + instância + deployment)
 */

import { ChatOpenAI, AzureChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ILLMProvider } from './ILLMProvider';

export class OpenAIProvider implements ILLMProvider {
    readonly name = 'openai';
    readonly defaultModel: string;

    constructor() {
        this.defaultModel = process.env.OPENAI_MODEL ?? 'gpt-4o';
    }

    isConfigured(): boolean {
        return !!process.env.OPENAI_API_KEY;
    }

    buildChatModel(model: string, temperature: number): ChatOpenAI {
        return new ChatOpenAI({
            model,
            temperature,
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async listModels(): Promise<string[]> {
        try {
            const client = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const models = await (client as any).client.models.list();
            return (models.data as Array<{ id: string }>)
                .filter(m => m.id.startsWith('gpt'))
                .map(m => m.id)
                .sort()
                .reverse();
        } catch {
            return ['gpt-4o', 'gpt-4o-mini'];
        }
    }

    async embed(text: string): Promise<number[]> {
        const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
        return embeddings.embedQuery(text);
    }
}

export class AzureOpenAIProvider implements ILLMProvider {
    readonly name = 'azure-openai';
    readonly defaultModel: string;

    constructor() {
        this.defaultModel = process.env.AZURE_OPENAI_MODEL ?? 'gpt-4o';
    }

    isConfigured(): boolean {
        return !!(
            process.env.AZURE_OPENAI_API_KEY &&
            process.env.AZURE_OPENAI_INSTANCE_NAME &&
            process.env.AZURE_OPENAI_DEPLOYMENT_NAME
        );
    }

    buildChatModel(model: string, temperature: number): AzureChatOpenAI {
        return new AzureChatOpenAI({
            model,
            temperature,
            azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
            azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_INSTANCE_NAME,
            azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-01',
        });
    }

    async listModels(): Promise<string[]> {
        return [process.env.AZURE_OPENAI_MODEL ?? 'gpt-4o'];
    }

    async embed(_text: string): Promise<number[]> {
        return [];
    }
}
