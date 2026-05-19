/**
 * AgentExecution — Aggregate root para uma execução do agente.
 *
 * Representa o ciclo de vida completo de uma execução: desde o planejamento
 * até a conclusão ou falha. Armazena o plano gerado, as iterações realizadas
 * e o resultado final.
 *
 * Separado do TaskAggregate para permitir múltiplas execuções por tarefa
 * (ex: retentativas) e manter o histórico de execuções.
 */

export type ExecutionStatus =
    | 'planning'    // gerando plano de execução
    | 'running'     // executando steps do plano
    | 'completed'   // concluído com sucesso
    | 'failed'      // falhou
    | 'cancelled';  // cancelado externamente

export interface ExecutionStep {
    id: string;
    /** Tipo do step — determina qual executor será usado. */
    type: 'code_edit' | 'terminal' | 'vcs_operation' | 'validation' | 'review' | 'memory_store';
    description: string;
    /** Nome da tool/executor a ser invocado. */
    tool: string;
    /** Parâmetros para o executor. */
    parameters: Record<string, unknown>;
    /** IDs de steps que devem concluir antes deste. Permite paralelismo. */
    dependsOn: string[];
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
    result?: string;
    startedAt?: Date;
    completedAt?: Date;
}

export interface ExecutionPlan {
    steps: ExecutionStep[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    /** Se true, um container efêmero será provisionado para execução local. */
    requiresLocalExecution: boolean;
    /** Modelo sugerido pelo LLM para executar este plano. */
    suggestedModel: string;
    /** Justificativa do plano gerada pelo LLM. */
    rationale: string;
}

export interface AgentExecutionProps {
    id: string;
    taskId: string;
    repositoryPrefix: string;
    status: ExecutionStatus;
    plan?: ExecutionPlan;
    selectedModel?: string;
    providerName?: string;
    iterations: number;
    modifiedFiles: string[];
    finalSummary?: string;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
}

export class AgentExecutionAggregate {
    private _status: ExecutionStatus;
    private _plan?: ExecutionPlan;
    private _selectedModel?: string;
    private _providerName?: string;
    private _iterations: number;
    private _modifiedFiles: string[];
    private _finalSummary?: string;
    private _errorMessage?: string;
    private _completedAt?: Date;

    readonly id: string;
    readonly taskId: string;
    readonly repositoryPrefix: string;
    readonly startedAt: Date;

    private constructor(props: AgentExecutionProps) {
        this.id = props.id;
        this.taskId = props.taskId;
        this.repositoryPrefix = props.repositoryPrefix;
        this._status = props.status;
        this._plan = props.plan;
        this._selectedModel = props.selectedModel;
        this._providerName = props.providerName;
        this._iterations = props.iterations;
        this._modifiedFiles = props.modifiedFiles;
        this._finalSummary = props.finalSummary;
        this._errorMessage = props.errorMessage;
        this.startedAt = props.startedAt ?? new Date();
        this._completedAt = props.completedAt;
    }

    static create(props: Omit<AgentExecutionProps, 'status' | 'iterations' | 'modifiedFiles'>): AgentExecutionAggregate {
        return new AgentExecutionAggregate({
            ...props,
            status: 'planning',
            iterations: 0,
            modifiedFiles: [],
        });
    }

    static fromProps(props: AgentExecutionProps): AgentExecutionAggregate {
        return new AgentExecutionAggregate(props);
    }

    // ─── Accessors ───────────────────────────────────────────────────────────────

    get status(): ExecutionStatus { return this._status; }
    get plan(): ExecutionPlan | undefined { return this._plan; }
    get selectedModel(): string | undefined { return this._selectedModel; }
    get providerName(): string | undefined { return this._providerName; }
    get iterations(): number { return this._iterations; }
    get modifiedFiles(): string[] { return [...this._modifiedFiles]; }
    get finalSummary(): string | undefined { return this._finalSummary; }
    get errorMessage(): string | undefined { return this._errorMessage; }
    get completedAt(): Date | undefined { return this._completedAt; }

    // ─── Transições de estado ────────────────────────────────────────────────────

    assignPlan(plan: ExecutionPlan, model: string, provider: string): void {
        this._plan = plan;
        this._selectedModel = model;
        this._providerName = provider;
        this._status = 'running';
    }

    recordIteration(): void {
        this._iterations++;
    }

    addModifiedFile(filePath: string): void {
        if (!this._modifiedFiles.includes(filePath)) {
            this._modifiedFiles.push(filePath);
        }
    }

    complete(summary: string): void {
        this._status = 'completed';
        this._finalSummary = summary;
        this._completedAt = new Date();
    }

    fail(errorMessage: string): void {
        this._status = 'failed';
        this._errorMessage = errorMessage;
        this._completedAt = new Date();
    }

    cancel(): void {
        this._status = 'cancelled';
        this._completedAt = new Date();
    }
}
