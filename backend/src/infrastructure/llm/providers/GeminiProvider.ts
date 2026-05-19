/**
 * GeminiProvider — Adapter LLM para Google Gemini.
 *
 * Aceita tanto GEMINI_API_KEY quanto GOOGLE_API_KEY (alias).
 * Sincroniza automaticamente as duas variáveis para compatibilidade
 * com o @langchain/google-genai que espera GOOGLE_API_KEY.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ILLMProvider } from './ILLMProvider';

export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini';
  readonly defaultModel: string;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
    this.defaultModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

    // Garante que GOOGLE_API_KEY está definida para o LangChain
    if (this.apiKey && !process.env.GOOGLE_API_KEY) {
      process.env.GOOGLE_API_KEY = this.apiKey;
    }
  }

  isConfigured(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  }

  buildChatModel(model: string, temperature: number): ChatGoogleGenerativeAI {
    return new ChatGoogleGenerativeAI({
      model,
      temperature,
      apiKey: this.apiKey,
    });
  }

  async listModels(): Promise<string[]> {
    // Google não tem endpoint simples de listagem via LangChain — lista estática
    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ];
  }

  async embed(_text: string): Promise<number[]> {
    // Gemini tem API de embeddings mas requer SDK separado
    return [];
  }
}
