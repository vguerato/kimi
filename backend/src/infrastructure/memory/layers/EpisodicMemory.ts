/**
 * EpisodicMemory — Camada de memória episódica via Mem0.
 *
 * O que é memória episódica?
 *   Armazena "episódios" — eventos específicos que aconteceram no passado.
 *   Aqui, cada episódio é uma execução do agente: o que foi feito, com qual
 *   resultado, em qual projeto. Permite que o agente aprenda com execuções
 *   anteriores sem precisar re-analisar o código do zero.
 *
 * Backend suportado: Mem0 (Cloud ou OSS self-hosted).
 *   - MEM0_API_KEY definido → Mem0 Cloud
 *   - MEM0_BASE_URL definido → Mem0 OSS
 *   - Nenhum definido → memória episódica desabilitada (sem erro)
 *
 * Quando o Mem0 não está disponível, o CompositeMemoryAdapter usa a
 * ProceduralMemory como fallback — o sistema continua funcionando.
 */

import { logger } from '../../../config/logger';
import { ExecutionMemory, MemoryEntry, MemorySearchOptions } from '../../../domain/agent/ports/IMemoryPort';

const log = logger.child({ module: 'episodic-memory' });

export class EpisodicMemory {
  private client: unknown = null;
  private initialized = false;

  /**
   * Inicializa a conexão com o Mem0.
   *
   * Idempotente — chamadas subsequentes são ignoradas.
   * Falhas de conexão são logadas mas não lançam exceção, permitindo
   * que o sistema inicie mesmo sem Mem0 configurado.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const apiKey = process.env.MEM0_API_KEY;
    const baseUrl = process.env.MEM0_BASE_URL;

    if (!apiKey && !baseUrl) {
      log.debug('Mem0 não configurado — memória episódica desabilitada');
      this.initialized = true;
      return;
    }

    try {
      const { MemoryClient } = await import('mem0ai');
      this.client = apiKey
        ? new MemoryClient({ apiKey })
        : new MemoryClient({ apiKey: 'local', host: baseUrl } as never);

      log.info({ mode: apiKey ? 'cloud' : 'oss' }, 'Mem0 inicializado (memória episódica)');
    } catch (err) {
      log.warn({ err }, 'Mem0 não disponível — memória episódica desabilitada');
    }

    this.initialized = true;
  }

  /**
   * Indica se o Mem0 está disponível para uso.
   * Usado pelo CompositeMemoryAdapter para decidir qual camada usar.
   */
  get isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Armazena uma execução do agente na memória episódica.
   *
   * O conteúdo é formatado como texto legível pelo LLM — não como JSON —
   * para que o Mem0 possa indexar semanticamente e recuperar por similaridade.
   *
   * Lança erro se o Mem0 falhar, permitindo que o caller (CompositeMemoryAdapter)
   * decida se deve usar o fallback.
   */
  async store(memory: ExecutionMemory): Promise<void> {
    if (!this.client) return;

    const content = this.format(memory);
    const metadata = {
      type: 'execution',
      repoId: memory.repoId,
      taskId: memory.taskId,
      outcome: memory.outcome,
      model: memory.model,
      timestamp: new Date().toISOString(),
    };

    try {
      await (this.client as { add: (msgs: unknown[], opts: unknown) => Promise<void> }).add(
        [{ role: 'user', content }],
        { user_id: memory.repoId, metadata },
      );
    } catch (err) {
      log.warn({ err, taskId: memory.taskId }, 'Falha ao armazenar memória episódica no Mem0');
      throw err;
    }
  }

  /**
   * Busca memórias relevantes para uma query usando similaridade semântica.
   *
   * O Mem0 usa embeddings para encontrar memórias semanticamente similares
   * à query — não apenas correspondência exata de palavras.
   *
   * Retorna array vazio em caso de falha (não lança exceção).
   */
  async search(repoId: string, query: string, options: MemorySearchOptions = {}): Promise<MemoryEntry[]> {
    if (!this.client) return [];

    try {
      const results = await (this.client as {
        search: (q: string, opts: unknown) => Promise<Array<{
          id?: string;
          memory?: string;
          content?: string;
          metadata?: Record<string, unknown>;
          score?: number;
        }>>
      }).search(query, {
        user_id: repoId,
        limit: options.limit ?? 5,
      });

      return (results ?? []).map(r => ({
        id: r.id,
        content: r.memory ?? r.content ?? '',
        metadata: r.metadata ?? {},
        score: r.score,
      }));
    } catch (err) {
      log.warn({ err }, 'Busca na memória episódica falhou');
      return [];
    }
  }

  /**
   * Remove todas as memórias de um repositório específico.
   * Chamado quando o usuário solicita limpeza de memória via API.
   */
  async deleteAll(repoId: string): Promise<void> {
    if (!this.client) return;
    try {
      await (this.client as { deleteAll: (opts: unknown) => Promise<void> }).deleteAll({ user_id: repoId });
    } catch (err) {
      log.warn({ err, repoId }, 'Falha ao limpar memória episódica no Mem0');
    }
  }

  /**
   * Formata uma execução como texto legível pelo LLM.
   *
   * O formato é intencional: texto natural em vez de JSON para que o Mem0
   * possa indexar semanticamente e o LLM possa entender sem parsing.
   */
  private format(memory: ExecutionMemory): string {
    const lines = [
      `Tarefa: ${memory.taskTitle} (${memory.taskId})`,
      `Resultado: ${memory.outcome === 'success' ? '✅ Sucesso' : '❌ Falha'}`,
      `Modelo: ${memory.model} (${memory.provider})`,
      `Iterações: ${memory.iterations}`,
    ];
    if (memory.modifiedFiles.length > 0) lines.push(`Arquivos: ${memory.modifiedFiles.join(', ')}`);
    if (memory.finalSummary) lines.push(`Resumo: ${memory.finalSummary.slice(0, 300)}`);
    if (memory.errorMessage) lines.push(`Erro: ${memory.errorMessage.slice(0, 200)}`);
    return lines.join('\n');
  }
}
