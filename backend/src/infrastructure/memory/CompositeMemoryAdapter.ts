/**
 * CompositeMemoryAdapter — Orquestrador das camadas de memória do agente.
 *
 * Implementa IMemoryPort coordenando duas camadas especializadas:
 *
 *   EpisodicMemory  (Mem0)         → busca semântica por similaridade
 *   ProceduralMemory (JSON local)  → persistência estruturada e fallback
 *
 * ─── Estratégia de escrita (dual-write) ──────────────────────────────────────
 *
 *   Toda memória é escrita em ambas as camadas disponíveis.
 *   Se o Mem0 falhar, a ProceduralMemory mantém os dados — o sistema
 *   nunca perde uma execução por falha de conectividade.
 *
 * ─── Estratégia de leitura ───────────────────────────────────────────────────
 *
 *   Busca semântica (searchRelevantMemories):
 *     1. Tenta Mem0 (busca por similaridade semântica)
 *     2. Fallback: execuções recentes da ProceduralMemory
 *
 *   Contexto de projeto (getProjectContext):
 *     Sempre usa ProceduralMemory — é a fonte de verdade para objetos
 *     estruturados. O Mem0 armazena apenas texto, não o objeto tipado.
 *
 * ─── Como adicionar uma nova camada ──────────────────────────────────────────
 *
 *   Exemplo: adicionar Weaviate para memória semântica vetorial
 *   1. Crie `layers/SemanticMemory.ts` implementando a interface necessária
 *   2. Instancie em `initialize()` e chame `semanticMemory.initialize()`
 *   3. Adicione ao dual-write em `storeExecutionContext()`
 *   4. Adicione à busca em `searchRelevantMemories()` (antes do fallback)
 */

import { injectable } from 'tsyringe';
import { logger } from '../../config/logger';
import {
  IMemoryPort,
  MemoryEntry,
  MemorySearchOptions,
  ExecutionMemory,
  ProjectContextMemory,
} from '../../domain/agent/ports/IMemoryPort';
import { EpisodicMemory } from './layers/EpisodicMemory';
import { ProceduralMemory } from './layers/ProceduralMemory';

const log = logger.child({ module: 'memory' });

@injectable()
export class CompositeMemoryAdapter implements IMemoryPort {
  private readonly episodic = new EpisodicMemory();
  private readonly procedural = new ProceduralMemory();
  private initialized = false;

  /**
   * Inicializa todas as camadas de memória.
   *
   * Idempotente — chamadas subsequentes são ignoradas.
   * Deve ser chamado uma vez no bootstrap, após o container ser configurado.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.episodic.initialize();

    if (this.episodic.isAvailable) {
      log.info('Memória: Mem0 (episódica) + JSON local (procedural)');
    } else {
      log.info('Memória: JSON local (procedural) — configure MEM0_API_KEY para memória episódica');
    }

    this.initialized = true;
  }

  // ─── Escrita ──────────────────────────────────────────────────────────────

  /**
   * Armazena o contexto de uma execução concluída.
   *
   * Dual-write: persiste em ambas as camadas em paralelo.
   * Falha na EpisodicMemory é logada mas não impede a escrita na ProceduralMemory.
   */
  async storeExecutionContext(memory: ExecutionMemory): Promise<void> {
    const writes: Promise<void>[] = [
      Promise.resolve(this.procedural.storeExecution(memory)),
    ];

    if (this.episodic.isAvailable) {
      writes.push(
        this.episodic.store(memory).catch(err =>
          log.warn({ err, taskId: memory.taskId }, 'Falha na escrita episódica — procedural mantida'),
        ),
      );
    }

    await Promise.all(writes);
  }

  /**
   * Armazena o contexto sintetizado de um projeto após indexação.
   *
   * ProceduralMemory recebe o objeto estruturado completo.
   * EpisodicMemory recebe uma versão textual para busca semântica futura.
   */
  async storeProjectContext(context: ProjectContextMemory): Promise<void> {
    this.procedural.storeProjectContext(context);

    if (this.episodic.isAvailable) {
      const textContent = this.formatProjectContextAsText(context);
      await this.episodic.store({
        repoId: context.repoId,
        taskId: `project-context:${context.repoId}`,
        taskTitle: `Contexto do projeto ${context.repoId}`,
        taskDescription: context.synthesizedContext,
        outcome: 'success',
        model: 'system',
        provider: 'system',
        iterations: 0,
        modifiedFiles: [],
        finalSummary: textContent,
        branch: '',
      }).catch(err => log.warn({ err }, 'Falha ao armazenar contexto de projeto no Mem0'));
    }
  }

  // ─── Leitura ──────────────────────────────────────────────────────────────

  /**
   * Busca memórias relevantes para uma query.
   *
   * Tenta busca semântica no Mem0 primeiro. Se não disponível ou sem
   * resultados, retorna execuções recentes da ProceduralMemory.
   */
  async searchRelevantMemories(
    repoId: string,
    query: string,
    options: MemorySearchOptions = {},
  ): Promise<MemoryEntry[]> {
    if (this.episodic.isAvailable) {
      const results = await this.episodic.search(repoId, query, options);
      if (results.length > 0) return results;
    }

    const limit = options.limit ?? 5;
    const recent = this.procedural.getRecentExecutions(repoId, limit);
    return recent.map(exec => ({
      content: this.formatExecutionAsText(exec),
      metadata: { type: 'execution', repoId, outcome: exec.outcome },
    }));
  }

  /**
   * Retorna o contexto estruturado de um projeto.
   *
   * Sempre usa ProceduralMemory — é a fonte de verdade para objetos tipados.
   * Retorna null se o projeto ainda não foi indexado.
   */
  async getProjectContext(repoId: string): Promise<ProjectContextMemory | null> {
    return this.procedural.getProjectContext(repoId);
  }

  /**
   * Constrói uma string de contexto para injeção no prompt do agente.
   *
   * Combina:
   *   1. Contexto do projeto (linguagem, framework, convenções, specs)
   *   2. Execuções anteriores relevantes (aprendizado de tarefas similares)
   */
  async buildContextString(
    repoId: string,
    taskTitle: string,
    taskDescription: string,
  ): Promise<string> {
    const query = `${taskTitle} ${taskDescription}`.trim();
    const sections: string[] = [];

    const projectCtx = await this.getProjectContext(repoId);
    if (projectCtx) {
      sections.push(this.formatProjectContextForPrompt(projectCtx));
    }

    const memories = await this.searchRelevantMemories(repoId, query, { limit: 3 });
    if (memories.length > 0) {
      sections.push('## Execuções Anteriores Relevantes');
      sections.push('> Contexto de tarefas similares executadas neste repositório.');
      sections.push('');
      memories.forEach((m, i) => {
        sections.push(`### Execução ${i + 1}`);
        sections.push(m.content);
        sections.push('');
      });
    }

    return sections.join('\n\n');
  }

  /**
   * Remove toda a memória de um projeto (contexto + execuções).
   * Chamado quando o usuário solicita limpeza via API.
   */
  async clearProjectMemory(repoId: string): Promise<void> {
    this.procedural.clearProject(repoId);

    if (this.episodic.isAvailable) {
      await this.episodic.deleteAll(repoId);
    }

    log.info({ repoId }, 'Memória do projeto limpa');
  }

  // ─── Formatadores ─────────────────────────────────────────────────────────

  /** Formata uma execução como texto legível pelo LLM. */
  private formatExecutionAsText(memory: ExecutionMemory): string {
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

  /** Formata o contexto do projeto como texto para armazenamento no Mem0. */
  private formatProjectContextAsText(context: ProjectContextMemory): string {
    const lines = [
      `Projeto: ${context.repoId}`,
      `Linguagem: ${context.language ?? 'desconhecida'}`,
      `Framework: ${context.framework ?? 'desconhecido'}`,
    ];
    if (context.buildCommand) lines.push(`Build: ${context.buildCommand}`);
    if (context.testCommand) lines.push(`Testes: ${context.testCommand}`);
    if (context.lintCommand) lines.push(`Lint: ${context.lintCommand}`);
    if (context.conventions.length > 0) lines.push(`Convenções: ${context.conventions.join('; ')}`);
    lines.push(`Contexto: ${context.synthesizedContext.slice(0, 500)}`);
    return lines.join('\n');
  }

  /** Formata o contexto do projeto para injeção no prompt do agente. */
  private formatProjectContextForPrompt(context: ProjectContextMemory): string {
    const lines = ['## Contexto do Projeto', '', context.synthesizedContext, ''];

    if (context.language) lines.push(`**Linguagem principal:** ${context.language}`);
    if (context.framework) lines.push(`**Framework:** ${context.framework}`);
    if (context.buildCommand) lines.push(`**Build:** \`${context.buildCommand}\``);
    if (context.testCommand) lines.push(`**Testes:** \`${context.testCommand}\``);
    if (context.lintCommand) lines.push(`**Lint:** \`${context.lintCommand}\``);

    if (context.conventions.length > 0) {
      lines.push('', '**Convenções:**');
      context.conventions.forEach(c => lines.push(`- ${c}`));
    }

    if (context.specs.length > 0) {
      lines.push('', '**Specs e Diretrizes:**');
      context.specs.forEach(s => lines.push(`- ${s}`));
    }

    return lines.join('\n');
  }
}

/** Singleton — instanciado uma vez no bootstrap. */
export const memoryAdapter = new CompositeMemoryAdapter();
