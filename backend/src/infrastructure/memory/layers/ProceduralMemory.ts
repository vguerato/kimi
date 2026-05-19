/**
 * ProceduralMemory — Camada de memória procedural (persistência local em JSON).
 *
 * O que é memória procedural?
 *   Armazena "como fazer as coisas" — padrões, contextos e histórico estruturado.
 *   Aqui, armazena dois tipos de dados:
 *     1. Contexto de projeto: linguagem, framework, comandos, convenções
 *     2. Histórico de execuções: o que foi feito em cada tarefa
 *
 * Por que JSON local?
 *   - Funciona sem dependências externas (sem Mem0, sem banco extra)
 *   - É a fonte de verdade para objetos estruturados (Mem0 armazena texto)
 *   - Serve como fallback quando Mem0 não está disponível
 *
 * Limites:
 *   - Máximo de 50 execuções por repositório (circular buffer — descarta as mais antigas)
 *   - Persiste em /app/data/memory.json (produção) ou ./data/memory.json (dev)
 *
 * Quando usar ProceduralMemory vs EpisodicMemory:
 *   - ProceduralMemory: leitura de contexto estruturado (getProjectContext)
 *   - EpisodicMemory: busca semântica por similaridade (searchRelevantMemories)
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../../config/logger';
import { ExecutionMemory, ProjectContextMemory } from '../../../domain/agent/ports/IMemoryPort';

const log = logger.child({ module: 'procedural-memory' });

const MAX_EXECUTIONS_PER_REPO = 50;

interface MemoryStore {
  executions: Record<string, ExecutionMemory[]>;
  projectContexts: Record<string, ProjectContextMemory>;
}

export class ProceduralMemory {
  private readonly filePath: string;
  private store: MemoryStore = { executions: {}, projectContexts: {} };

  /**
   * Cria uma instância da memória procedural.
   *
   * @param dataDir - Diretório onde o arquivo JSON será salvo.
   *   Padrão: `./data/` (relativo ao cwd). Em produção, use `/app/data/`.
   *   Em testes, passe um diretório temporário para isolamento.
   */
  constructor(dataDir?: string) {
    const dir = dataDir ?? path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, 'memory.json');
    this.load();
  }

  // ─── Execuções ────────────────────────────────────────────────────────────

  /**
   * Armazena uma execução do agente.
   *
   * Implementa um circular buffer por repositório: quando o limite de
   * MAX_EXECUTIONS_PER_REPO é atingido, as execuções mais antigas são
   * descartadas para manter o arquivo compacto.
   */
  storeExecution(memory: ExecutionMemory): void {
    if (!this.store.executions[memory.repoId]) {
      this.store.executions[memory.repoId] = [];
    }

    this.store.executions[memory.repoId].push(memory);

    if (this.store.executions[memory.repoId].length > MAX_EXECUTIONS_PER_REPO) {
      this.store.executions[memory.repoId] =
        this.store.executions[memory.repoId].slice(-MAX_EXECUTIONS_PER_REPO);
    }

    this.persist();
  }

  /**
   * Retorna as N execuções mais recentes de um repositório.
   * Usado como fallback quando o Mem0 não está disponível.
   */
  getRecentExecutions(repoId: string, limit = 5): ExecutionMemory[] {
    return (this.store.executions[repoId] ?? []).slice(-limit);
  }

  // ─── Contexto de projeto ──────────────────────────────────────────────────

  /**
   * Armazena o contexto sintetizado de um projeto.
   *
   * Sobrescreve o contexto anterior — cada indexação produz um contexto
   * completo e atualizado, não incremental.
   */
  storeProjectContext(context: ProjectContextMemory): void {
    this.store.projectContexts[context.repoId] = {
      ...context,
      indexedAt: context.indexedAt ?? new Date().toISOString(),
    };
    this.persist();
  }

  /**
   * Retorna o contexto de um projeto, ou null se não indexado.
   *
   * É a fonte de verdade para objetos estruturados — o Mem0 armazena
   * apenas texto, não o objeto completo com todos os campos tipados.
   */
  getProjectContext(repoId: string): ProjectContextMemory | null {
    return this.store.projectContexts[repoId] ?? null;
  }

  // ─── Limpeza ──────────────────────────────────────────────────────────────

  /**
   * Remove todas as memórias de um projeto (execuções + contexto).
   * Chamado quando o usuário solicita limpeza via API.
   */
  clearProject(repoId: string): void {
    delete this.store.executions[repoId];
    delete this.store.projectContexts[repoId];
    this.persist();
  }

  // ─── Persistência ─────────────────────────────────────────────────────────

  /**
   * Carrega o store do arquivo JSON.
   * Chamado no construtor — falhas resultam em store vazio (não lança exceção).
   */
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.store = JSON.parse(raw) as MemoryStore;
      }
    } catch {
      log.warn({ path: this.filePath }, 'Falha ao carregar memória local — iniciando vazia');
      this.store = { executions: {}, projectContexts: {} };
    }
  }

  /**
   * Persiste o store no arquivo JSON.
   * Chamado após cada escrita — falhas são logadas mas não lançam exceção.
   */
  private persist(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch (err) {
      log.warn({ err }, 'Falha ao persistir memória local');
    }
  }
}
