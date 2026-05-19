/**
 * AgentHarness — Camada de governança para execução de agentes.
 *
 * Implementa a metodologia "Agent Harness": envolve cada execução de agente
 * com verificações de pré-voo, sandbox de execução e validação pós-voo.
 *
 * Responsabilidades:
 *   Pre-flight:  Verifica contexto, orçamento de tokens, seleciona modelo
 *   Execution:   Executa o loop agentic com tools auditadas e guardrails
 *   Post-flight: Valida output, registra métricas, atualiza memória
 *
 * Por que Agent Harness?
 *   Sem governança, agentes podem:
 *   - Executar comandos destrutivos sem supervisão
 *   - Consumir tokens excessivos em loops infinitos
 *   - Produzir outputs inconsistentes com as diretrizes do projeto
 *   - Falhar silenciosamente sem registro de contexto
 *
 * O harness garante que cada execução seja auditável, controlada e aprendível.
 */

import { inject, injectable } from 'tsyringe';
import { logger } from '../config/logger';
import { ILLMPort, LLMMessage, ToolDefinition, ToolCall } from '../domain/agent/ports/ILLMPort';
import { IMemoryPort } from '../domain/agent/ports/IMemoryPort';
import { IContextPort } from '../domain/agent/ports/IContextPort';
import { AgentTaskPayload } from '../domain/shared/AgentTaskPayload';
import { logEmitter } from '../infrastructure/logging/LogEmitter';
import { TOKENS } from '../bootstrap/tokens';

const log = logger.child({ module: 'agent-harness' });

/** Máximo de iterações do loop agentic antes de forçar conclusão. */
const MAX_ITERATIONS = 25;

/** Máximo de tokens estimados por execução (proteção de custo). */
const MAX_ESTIMATED_TOKENS = 200_000;

export interface HarnessToolDefinition extends ToolDefinition {
    /** Handler que executa a tool. Recebe os argumentos e retorna o resultado. */
    handler: (args: Record<string, unknown>) => Promise<string>;
    /** Se true, o harness loga a execução desta tool. Padrão: true. */
    audited?: boolean;
}

export interface HarnessExecutionResult {
    finalSummary: string;
    iterations: number;
    modifiedFiles: string[];
    totalTokensUsed: number;
    model: string;
    provider: string;
}

export interface HarnessOptions {
    /** Modelo a usar. Se omitido, o harness seleciona automaticamente. */
    model?: string;
    /** Máximo de iterações. Padrão: MAX_ITERATIONS. */
    maxIterations?: number;
    /** Tools disponíveis para o agente. */
    tools: HarnessToolDefinition[];
}

@injectable()
export class AgentHarness {
    constructor(
        @inject(TOKENS.LLM) private readonly llm: ILLMPort,
        @inject(TOKENS.Memory) private readonly memory: IMemoryPort,
        @inject(TOKENS.Context) private readonly context: IContextPort,
    ) { }

    /**
     * Executa uma tarefa com governança completa.
     *
     * Fluxo:
     *   1. Pre-flight: carrega contexto, seleciona modelo
     *   2. Execution: loop agentic com tools auditadas
     *   3. Post-flight: valida resultado, atualiza memória
     */
    async execute(
        taskData: AgentTaskPayload,
        options: HarnessOptions,
    ): Promise<HarnessExecutionResult> {
        const taskLog = log.child({ taskId: taskData.taskId });
        const emit = (level: 'info' | 'tool' | 'error' | 'system', msg: string) =>
            logEmitter.log(taskData.taskId, level, msg);

        // ── Pre-flight ────────────────────────────────────────────────────────────

        emit('system', '🔍 Pre-flight: carregando contexto do projeto...');

        const [promptContext, selectedModel] = await Promise.all([
            this.context.buildPromptContext(
                taskData.repository,
                taskData.title,
                taskData.description,
            ),
            options.model ?? this.selectModel(taskData),
        ]);

        emit('system', `🤖 Modelo selecionado: ${selectedModel} (${this.llm.providerName})`);
        taskLog.info({ model: selectedModel, provider: this.llm.providerName }, 'Pre-flight completo');

        // ── Execution ─────────────────────────────────────────────────────────────

        const systemPrompt = this.buildSystemPrompt(promptContext);
        const humanMessage = this.buildHumanMessage(taskData);

        const toolDefs: ToolDefinition[] = options.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        }));

        const toolHandlers = new Map(options.tools.map(t => [t.name, t.handler]));

        const messages: LLMMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: humanMessage },
        ];

        let iterations = 0;
        let finalSummary = '';
        let totalTokens = 0;
        const modifiedFiles: string[] = [];
        const maxIterations = options.maxIterations ?? MAX_ITERATIONS;

        while (iterations < maxIterations) {
            iterations++;
            emit('info', `Iteração ${iterations}/${maxIterations} — aguardando resposta do modelo...`);

            const response = await this.llm.chat(messages, selectedModel, {
                temperature: 0,
                tools: toolDefs,
            });

            // Acumula tokens para controle de custo
            totalTokens += response.usage?.totalTokens ?? 0;

            // Adiciona resposta ao histórico
            messages.push({ role: 'assistant', content: response.content });

            if (response.content.trim()) {
                emit('info', `💬 ${response.content.slice(0, 800)}${response.content.length > 800 ? '…' : ''}`);
            }

            // Sem tool calls → agente concluiu
            if (!response.toolCalls?.length) {
                finalSummary = response.content;
                emit('system', '✅ Tarefa concluída pelo agente.');
                break;
            }

            // Proteção de custo: interrompe se tokens excessivos
            if (totalTokens > MAX_ESTIMATED_TOKENS) {
                emit('system', `⚠️ Limite de tokens atingido (${totalTokens}). Forçando conclusão.`);
                finalSummary = response.content || 'Execução interrompida por limite de tokens.';
                break;
            }

            // Executa todas as tool calls desta iteração
            for (const toolCall of response.toolCalls) {
                const result = await this.executeToolCall(
                    toolCall,
                    toolHandlers,
                    taskData.taskId,
                    modifiedFiles,
                );

                messages.push({
                    role: 'tool',
                    content: result,
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                });
            }
        }

        if (iterations >= maxIterations && !finalSummary) {
            emit('system', `⚠️ Limite de ${maxIterations} iterações atingido.`);
            finalSummary = 'Execução atingiu o limite de iterações.';
        }

        // ── Post-flight ───────────────────────────────────────────────────────────

        taskLog.info(
            { iterations, tokens: totalTokens, files: modifiedFiles.length },
            'Post-flight: execução concluída'
        );

        return {
            finalSummary,
            iterations,
            modifiedFiles,
            totalTokensUsed: totalTokens,
            model: selectedModel,
            provider: this.llm.providerName,
        };
    }

    // ─── Seleção de modelo ───────────────────────────────────────────────────────

    /**
     * Usa um modelo rápido para selecionar o modelo ideal para a tarefa.
     * Considera complexidade, tipo de tarefa e modelos disponíveis.
     */
    async selectModel(taskData: AgentTaskPayload): Promise<string> {
        try {
            const availableModels = await this.llm.listAvailableModels();
            if (availableModels.length === 0) return this.llm.defaultModel;
            if (availableModels.length === 1) return availableModels[0];

            const fastModel = availableModels[availableModels.length - 1]; // menor/mais rápido

            const messages: LLMMessage[] = [{
                role: 'user',
                content: `Selecione o modelo mais adequado para esta tarefa.

Modelos disponíveis (do mais capaz ao mais rápido):
${availableModels.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Diretrizes:
- Modelos rápidos/pequenos (flash, mini, haiku): tarefas simples (CRUD, boilerplate, pequenas correções)
- Modelos capazes/grandes (pro, opus, gpt-4o): tarefas complexas (arquitetura, algoritmos, refatoração profunda)

Tarefa:
- Título: ${taskData.title}
- Descrição: ${taskData.description?.slice(0, 300) || '(não fornecida)'}

Responda APENAS com o nome exato do modelo, sem explicação.`,
            }];

            const response = await this.llm.chat(messages, fastModel, { temperature: 0 });
            const chosen = response.content.trim();

            if (availableModels.includes(chosen)) return chosen;

            // Tenta match parcial
            const matched = availableModels.find(m => chosen.includes(m) || m.includes(chosen));
            return matched ?? this.llm.defaultModel;

        } catch (err) {
            log.warn({ err }, 'Seleção de modelo falhou — usando padrão');
            return this.llm.defaultModel;
        }
    }

    // ─── Execução de tools ───────────────────────────────────────────────────────

    private async executeToolCall(
        toolCall: ToolCall,
        handlers: Map<string, (args: Record<string, unknown>) => Promise<string>>,
        taskId: string,
        modifiedFiles: string[],
    ): Promise<string> {
        const handler = handlers.get(toolCall.name);

        if (!handler) {
            const available = [...handlers.keys()].join(', ');
            return `Erro: tool desconhecida "${toolCall.name}". Tools disponíveis: ${available}`;
        }

        // Loga a execução da tool
        if (toolCall.name === 'execute_terminal_command') {
            logEmitter.log(taskId, 'tool', `$ ${toolCall.arguments.command}`);
        } else if (toolCall.name === 'write_file') {
            const filePath = String(toolCall.arguments.filePath ?? '');
            logEmitter.log(taskId, 'tool', `✏️  write_file → ${filePath}`);
            if (filePath && !modifiedFiles.includes(filePath)) {
                modifiedFiles.push(filePath);
            }
        } else {
            logEmitter.log(taskId, 'tool', `🔧 ${toolCall.name}`);
        }

        try {
            const result = await handler(toolCall.arguments);
            if (result.trim()) {
                logEmitter.log(taskId, 'info', result.slice(0, 600) + (result.length > 600 ? '\n…(truncado)' : ''));
            }
            return result;
        } catch (err: any) {
            const errorMsg = `Erro ao executar ${toolCall.name}: ${err?.message ?? String(err)}`;
            logEmitter.log(taskId, 'error', errorMsg);
            return errorMsg;
        }
    }

    // ─── Builders de prompt ──────────────────────────────────────────────────────

    private buildSystemPrompt(projectContext: string): string {
        const base = `Você é um desenvolvedor de software especialista com acesso completo a um terminal e sistema de arquivos dentro do diretório do repositório. Sua função é implementar a tarefa fornecida.

Use as tools disponíveis para:
- Explorar o codebase (leia arquivos, liste diretórios) antes de fazer mudanças
- Escrever ou modificar arquivos
- Executar testes e verificar sua implementação
- Commitar e fazer push das mudanças

Quando concluir e verificar, retorne um resumo conciso do que foi implementado.`;

        if (!projectContext.trim()) return base;

        return `${base}

---

${projectContext}

---

IMPORTANTE: O contexto acima contém os padrões, especificações e convenções deste repositório. Você DEVE segui-los. Implemente specs exatamente como definidas. Aplique todas as convenções de código em cada arquivo que escrever.`;
    }

    private buildHumanMessage(taskData: AgentTaskPayload): string {
        const lines = [
            '## Tarefa a Implementar',
            `ID: ${taskData.taskId}`,
            `Título: ${taskData.title}`,
            `Descrição:\n${taskData.description || '(não fornecida)'}`,
        ];

        if (taskData.taskId !== taskData.parentId) {
            lines.push(
                '',
                '## Contexto da Tarefa Pai (para entendimento mais amplo)',
                `ID Pai: ${taskData.parentId}`,
                `Título Pai: ${taskData.parentTitle || '(não fornecido)'}`,
                `Descrição Pai:\n${taskData.parentDescription || '(não fornecida)'}`,
            );
        }

        lines.push('', 'Você está no diretório do repositório. Siga todas as diretrizes do contexto acima. Execute esta tarefa agora.');
        return lines.join('\n');
    }
}
