/**
 * LLMProviderRegistry — Registro e seleção de provedores LLM.
 *
 * Segue o mesmo padrão do ProjectManagerRegistry: provedores são registrados
 * explicitamente e o registry seleciona o ativo com base na configuração.
 *
 * OCP: Adicionar um novo provedor requer apenas criar um ILLMProvider e
 *      registrá-lo aqui — sem modificar lógica existente.
 *
 * Prioridade de seleção (ordem de registro):
 *   OpenAI → Anthropic → Azure OpenAI → Gemini → Ollama
 *
 * O primeiro provedor configurado (env vars presentes) é usado.
 * Para forçar um provedor específico, defina LLM_PROVIDER=gemini (por exemplo).
 */

import { logger } from '../../config/logger';
import { ILLMProvider } from './providers/ILLMProvider';

const log = logger.child({ module: 'llm-registry' });

export class LLMProviderRegistry {
    /** Provedores registrados, na ordem de prioridade. */
    private readonly providers: ILLMProvider[] = [];

    /** Provedor atualmente ativo (resolvido na primeira chamada). */
    private activeProvider: ILLMProvider | null = null;

    /**
     * Registra um provedor na lista de candidatos.
     * A ordem de registro define a prioridade de seleção.
     */
    register(provider: ILLMProvider): this {
        this.providers.push(provider);
        return this;
    }

    /**
     * Retorna o provedor ativo.
     *
     * Seleção:
     *   1. Se LLM_PROVIDER está definido, usa o provedor com esse nome
     *   2. Caso contrário, usa o primeiro provedor configurado (env vars presentes)
     *
     * Lança erro se nenhum provedor estiver configurado.
     */
    getActive(): ILLMProvider {
        if (this.activeProvider) return this.activeProvider;

        const forced = process.env.LLM_PROVIDER;
        if (forced) {
            const found = this.providers.find(p => p.name === forced);
            if (found && found.isConfigured()) {
                this.activeProvider = found;
                log.info({ provider: found.name, model: found.defaultModel }, 'LLM provider forçado via LLM_PROVIDER');
                return found;
            }
            log.warn({ forced }, 'LLM_PROVIDER especificado mas não configurado — usando detecção automática');
        }

        const configured = this.providers.find(p => p.isConfigured());
        if (!configured) {
            throw new Error(
                'Nenhum provedor LLM configurado. ' +
                'Defina pelo menos uma variável de ambiente: ' +
                'OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, ' +
                'AZURE_OPENAI_API_KEY ou OLLAMA_BASE_URL.',
            );
        }

        this.activeProvider = configured;
        log.info({ provider: configured.name, model: configured.defaultModel }, 'LLM provider ativo');
        return configured;
    }

    /** Retorna todos os provedores registrados com seu status de configuração. */
    getAll(): Array<{ name: string; defaultModel: string; configured: boolean }> {
        return this.providers.map(p => ({
            name: p.name,
            defaultModel: p.defaultModel,
            configured: p.isConfigured(),
        }));
    }
}
