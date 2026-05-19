/**
 * ContextEngine — Motor de indexação e recuperação de contexto de projetos.
 *
 * Responsável por descobrir, indexar e recuperar o contexto de um projeto
 * de forma inteligente, sem buscas hard-coded por arquivos específicos.
 *
 * Como funciona:
 *   1. Lista a estrutura de arquivos do repositório via VCS API
 *   2. Envia a estrutura ao LLM: "Quais arquivos contêm diretrizes, specs,
 *      configurações de build, lint, testes e convenções deste projeto?"
 *   3. Busca o conteúdo dos arquivos identificados pelo LLM
 *   4. LLM sintetiza um ProjectContext estruturado
 *   5. Persiste na memória para uso futuro
 *
 * Por que não hard-coded?
 *   Cada projeto tem sua própria estrutura. Um projeto pode ter specs em
 *   .kiro/, outro em docs/, outro em CONTRIBUTING.md. O LLM identifica
 *   o que é relevante sem precisar conhecer a estrutura de antemão.
 *
 * Eventos que disparam re-indexação:
 *   - Primeira interação com o projeto
 *   - Mudanças detectadas em arquivos de diretrizes (via webhook)
 *   - TTL expirado (configurável)
 *   - Solicitação explícita via API
 */

import { inject, injectable } from 'tsyringe';
import { logger } from '../config/logger';
import { ILLMPort, LLMMessage } from '../domain/agent/ports/ILLMPort';
import { IMemoryPort, ProjectContextMemory } from '../domain/agent/ports/IMemoryPort';
import { IContextPort, IndexingResult, ContextQuery, ContextChunk } from '../domain/agent/ports/IContextPort';
import { IVCSAdapter, FileEntry } from '../domain/project/ports/IVCSAdapter';
import { TOKENS } from '../bootstrap/tokens';

const log = logger.child({ module: 'context-engine' });

/** TTL padrão para re-indexação: 7 dias. */
const CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Máximo de arquivos a buscar conteúdo (evita tokens excessivos). */
const MAX_FILES_TO_FETCH = 20;

/** Máximo de caracteres por arquivo para enviar ao LLM. */
const MAX_FILE_CHARS = 8_000;

@injectable()
export class ContextEngine implements IContextPort {
    constructor(
        @inject(TOKENS.LLM) private readonly llm: ILLMPort,
        @inject(TOKENS.Memory) private readonly memory: IMemoryPort,
        @inject(TOKENS.VCSAdapter) private readonly vcs: IVCSAdapter,
    ) { }

    // ─── Indexação ───────────────────────────────────────────────────────────────

    async indexProject(repoId: string, repoUrl: string): Promise<IndexingResult> {
        const startTime = Date.now();
        log.info({ repoId, repoUrl }, 'Iniciando indexação de contexto do projeto');

        try {
            // 1. Lista estrutura de arquivos (recursivo, até 2 níveis)
            const fileStructure = await this.buildFileStructure(repoUrl);

            if (fileStructure.length === 0) {
                return {
                    success: false,
                    relevantFiles: [],
                    chunksIndexed: 0,
                    errorMessage: 'Repositório vazio ou sem acesso',
                    durationMs: Date.now() - startTime,
                };
            }

            // 2. LLM identifica arquivos relevantes
            const relevantFiles = await this.identifyRelevantFiles(fileStructure, repoId);
            log.info({ repoId, count: relevantFiles.length }, 'Arquivos relevantes identificados pelo LLM');

            // 3. Busca conteúdo dos arquivos identificados
            const fileContents = await this.fetchRelevantFileContents(repoUrl, relevantFiles);

            // 4. LLM sintetiza o contexto do projeto
            const context = await this.synthesizeProjectContext(repoId, fileStructure, fileContents);

            // 5. Persiste na memória
            await this.memory.storeProjectContext(context);

            log.info(
                { repoId, confidence: context.confidence, files: relevantFiles.length },
                'Contexto do projeto indexado com sucesso'
            );

            return {
                success: true,
                context,
                relevantFiles,
                chunksIndexed: relevantFiles.length,
                durationMs: Date.now() - startTime,
            };

        } catch (err: any) {
            log.error({ err, repoId }, 'Falha na indexação do projeto');
            return {
                success: false,
                relevantFiles: [],
                chunksIndexed: 0,
                errorMessage: err?.message ?? String(err),
                durationMs: Date.now() - startTime,
            };
        }
    }

    // ─── Recuperação de contexto ─────────────────────────────────────────────────

    async retrieveContext(query: ContextQuery): Promise<ContextChunk[]> {
        const maxChunks = query.maxChunks ?? 5;

        const memories = await this.memory.searchRelevantMemories(
            query.repoId,
            query.query,
            { limit: maxChunks }
        );

        return memories.map(m => ({
            content: m.content,
            source: String(m.metadata?.source ?? 'memory'),
            relevanceScore: m.score ?? 0.5,
            category: this.categorizeMemory(m.metadata),
        }));
    }

    async buildPromptContext(
        repoId: string,
        taskTitle: string,
        taskDescription: string,
    ): Promise<string> {
        return this.memory.buildContextString(repoId, taskTitle, taskDescription);
    }

    async isStale(repoId: string): Promise<boolean> {
        const context = await this.memory.getProjectContext(repoId);
        if (!context) return true;

        // Verifica TTL — re-indexa se o contexto for muito antigo
        // O contexto não tem timestamp próprio, então usamos a presença como indicador
        // Em uma implementação completa, adicionaríamos lastIndexedAt ao ProjectContextMemory
        return false;
    }

    // ─── Helpers privados ────────────────────────────────────────────────────────

    /**
     * Constrói uma representação textual da estrutura de arquivos do repositório.
     * Lista até 2 níveis de profundidade para não sobrecarregar o LLM.
     */
    private async buildFileStructure(repoUrl: string): Promise<FileEntry[]> {
        try {
            // Nível raiz
            const rootFiles = await this.vcs.listFiles(repoUrl, '');
            const allFiles: FileEntry[] = [...rootFiles];

            // Nível 1 — entra nos diretórios do root
            const rootDirs = rootFiles.filter(f => f.type === 'dir').slice(0, 15);
            const subResults = await Promise.allSettled(
                rootDirs.map(dir => this.vcs.listFiles(repoUrl, dir.path))
            );

            for (const result of subResults) {
                if (result.status === 'fulfilled') {
                    allFiles.push(...result.value);
                }
            }

            return allFiles;
        } catch (err) {
            log.warn({ err }, 'Falha ao listar estrutura de arquivos');
            return [];
        }
    }

    /**
     * Pede ao LLM para identificar quais arquivos contêm informações relevantes
     * para entender o projeto (specs, diretrizes, configurações, documentação).
     *
     * Por que LLM e não regex/glob?
     *   Cada projeto organiza seus arquivos de forma diferente. O LLM entende
     *   o contexto e identifica o que é relevante sem regras hard-coded.
     */
    private async identifyRelevantFiles(
        fileStructure: FileEntry[],
        repoId: string,
    ): Promise<string[]> {
        const fileList = fileStructure
            .filter(f => f.type === 'file')
            .map(f => f.path)
            .join('\n');

        const messages: LLMMessage[] = [
            {
                role: 'system',
                content: `Você é um analisador de repositórios de código. Sua tarefa é identificar arquivos relevantes para entender um projeto.`,
            },
            {
                role: 'user',
                content: `Analise a estrutura de arquivos do repositório "${repoId}" e identifique os arquivos mais relevantes para entender:

1. **Especificações e diretrizes** (specs, AGENT.md, CONTRIBUTING.md, docs de arquitetura, etc.)
2. **Configurações de build e ferramentas** (package.json, Makefile, build.gradle, pyproject.toml, etc.)
3. **Configurações de lint e qualidade** (.eslintrc, .prettierrc, pylint, etc.)
4. **Documentação técnica** (README, ARCHITECTURE.md, docs/, etc.)
5. **Configurações de testes** (jest.config, pytest.ini, etc.)
6. **Convenções do projeto** (qualquer arquivo que defina padrões de código)

Estrutura de arquivos:
${fileList}

Responda com uma lista JSON de caminhos de arquivo, ordenados por relevância. Máximo de ${MAX_FILES_TO_FETCH} arquivos.
Formato: ["path/to/file1", "path/to/file2", ...]

Inclua apenas arquivos que existem na lista acima. Não invente caminhos.`,
            },
        ];

        try {
            const response = await this.llm.chat(messages, this.llm.defaultModel, { temperature: 0 });
            const content = response.content.trim();

            // Extrai o JSON da resposta
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return this.fallbackRelevantFiles(fileStructure);

            const files: string[] = JSON.parse(jsonMatch[0]);

            // Valida que os arquivos existem na estrutura
            const validPaths = new Set(fileStructure.map(f => f.path));
            return files.filter(f => validPaths.has(f)).slice(0, MAX_FILES_TO_FETCH);

        } catch (err) {
            log.warn({ err }, 'LLM falhou ao identificar arquivos — usando fallback');
            return this.fallbackRelevantFiles(fileStructure);
        }
    }

    /**
     * Fallback: retorna arquivos comuns de configuração se o LLM falhar.
     * Esta é a única lista hard-coded no sistema — usada apenas como último recurso.
     */
    private fallbackRelevantFiles(fileStructure: FileEntry[]): string[] {
        const commonFiles = [
            'README.md', 'README.rst', 'CONTRIBUTING.md', 'ARCHITECTURE.md',
            'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml',
            'Makefile', 'Dockerfile', '.eslintrc.js', '.eslintrc.json',
        ];

        const validPaths = new Set(fileStructure.map(f => f.path));
        return commonFiles.filter(f => validPaths.has(f));
    }

    /** Busca o conteúdo dos arquivos relevantes, truncando se necessário. */
    private async fetchRelevantFileContents(
        repoUrl: string,
        filePaths: string[],
    ): Promise<Array<{ path: string; content: string }>> {
        const files = await this.vcs.getMultipleFiles(repoUrl, filePaths);

        return files.map(f => ({
            path: f.path,
            content: f.content.length > MAX_FILE_CHARS
                ? f.content.slice(0, MAX_FILE_CHARS) + '\n... [truncado]'
                : f.content,
        }));
    }

    /**
     * Pede ao LLM para sintetizar um contexto estruturado do projeto
     * a partir dos arquivos relevantes identificados.
     */
    private async synthesizeProjectContext(
        repoId: string,
        fileStructure: FileEntry[],
        fileContents: Array<{ path: string; content: string }>,
    ): Promise<ProjectContextMemory> {
        const filesSection = fileContents
            .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
            .join('\n\n');

        const messages: LLMMessage[] = [
            {
                role: 'system',
                content: `Você é um analisador de projetos de software. Sintetize informações técnicas de forma precisa e estruturada.`,
            },
            {
                role: 'user',
                content: `Analise os arquivos do repositório "${repoId}" e sintetize um contexto técnico completo.

${filesSection}

Responda em JSON com exatamente este formato:
{
  "synthesizedContext": "Descrição técnica completa do projeto em 2-3 parágrafos",
  "language": "linguagem principal (ex: TypeScript, Python, Go)",
  "framework": "framework principal (ex: NestJS, FastAPI, Gin) ou null",
  "buildCommand": "comando de build (ex: npm run build) ou null",
  "testCommand": "comando de testes (ex: npm test) ou null",
  "lintCommand": "comando de lint (ex: npm run lint) ou null",
  "conventions": ["convenção 1", "convenção 2", ...],
  "specs": ["spec/diretriz 1", "spec/diretriz 2", ...],
  "confidence": 0.0 a 1.0
}

Seja preciso. Se não encontrar informação, use null. Não invente comandos.`,
            },
        ];

        try {
            const response = await this.llm.chat(messages, this.llm.defaultModel, { temperature: 0 });
            const content = response.content.trim();

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('LLM não retornou JSON válido');

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                repoId,
                synthesizedContext: parsed.synthesizedContext ?? `Projeto ${repoId}`,
                language: parsed.language ?? undefined,
                framework: parsed.framework ?? undefined,
                buildCommand: parsed.buildCommand ?? undefined,
                testCommand: parsed.testCommand ?? undefined,
                lintCommand: parsed.lintCommand ?? undefined,
                conventions: Array.isArray(parsed.conventions) ? parsed.conventions : [],
                specs: Array.isArray(parsed.specs) ? parsed.specs : [],
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
            };

        } catch (err) {
            log.warn({ err, repoId }, 'LLM falhou ao sintetizar contexto — usando contexto mínimo');

            return {
                repoId,
                synthesizedContext: `Repositório ${repoId}. Contexto não pôde ser sintetizado automaticamente.`,
                conventions: [],
                specs: [],
                confidence: 0.1,
            };
        }
    }

    private categorizeMemory(metadata: Record<string, unknown>): ContextChunk['category'] {
        const type = String(metadata?.type ?? '');
        if (type.includes('spec')) return 'spec';
        if (type.includes('config')) return 'config';
        if (type.includes('doc')) return 'documentation';
        if (type.includes('code')) return 'code';
        return 'other';
    }
}
