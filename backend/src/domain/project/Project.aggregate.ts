/**
 * ProjectAggregate — Aggregate root para o domínio de Projeto/Repositório.
 *
 * Representa um repositório de código registrado no sistema, incluindo
 * seu provedor VCS, estado de indexação de contexto e metadados.
 *
 * Não possui dependências de infraestrutura — lógica de domínio pura.
 */

import { ProjectId } from './value-objects/ProjectId';
import { VCSProvider } from './value-objects/VCSProvider';

export type ProjectContextStatus =
    | 'pending'      // nunca indexado
    | 'indexing'     // indexação em andamento
    | 'indexed'      // contexto disponível
    | 'stale'        // contexto desatualizado (mudanças detectadas)
    | 'error';       // falha na indexação

export interface ProjectProps {
    id: ProjectId;
    /** Prefixo curto usado como chave de mapeamento (ex: "fin", "auth"). */
    prefix: string;
    /** URL completa do repositório no provedor VCS. */
    repositoryUrl: string;
    provider: VCSProvider;
    contextStatus: ProjectContextStatus;
    /** ISO timestamp da última indexação bem-sucedida. */
    lastIndexedAt?: string;
    /** Confiança do contexto indexado (0–1). */
    contextConfidence?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export class ProjectAggregate {
    private _contextStatus: ProjectContextStatus;
    private _lastIndexedAt?: string;
    private _contextConfidence?: number;

    readonly id: ProjectId;
    readonly prefix: string;
    readonly repositoryUrl: string;
    readonly provider: VCSProvider;
    readonly createdAt: Date;
    updatedAt: Date;

    private constructor(props: ProjectProps) {
        this.id = props.id;
        this.prefix = props.prefix;
        this.repositoryUrl = props.repositoryUrl;
        this.provider = props.provider;
        this._contextStatus = props.contextStatus;
        this._lastIndexedAt = props.lastIndexedAt;
        this._contextConfidence = props.contextConfidence;
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
    }

    static create(props: ProjectProps): ProjectAggregate {
        return new ProjectAggregate(props);
    }

    // ─── Accessors ───────────────────────────────────────────────────────────────

    get contextStatus(): ProjectContextStatus { return this._contextStatus; }
    get lastIndexedAt(): string | undefined { return this._lastIndexedAt; }
    get contextConfidence(): number | undefined { return this._contextConfidence; }

    // ─── Transições de estado ────────────────────────────────────────────────────

    /** Marca o início de uma indexação de contexto. */
    startIndexing(): void {
        this._contextStatus = 'indexing';
        this.touch();
    }

    /** Registra uma indexação bem-sucedida. */
    completeIndexing(confidence: number): void {
        this._contextStatus = 'indexed';
        this._lastIndexedAt = new Date().toISOString();
        this._contextConfidence = Math.max(0, Math.min(1, confidence));
        this.touch();
    }

    /** Marca o contexto como desatualizado (ex: mudanças detectadas no repo). */
    markStale(): void {
        this._contextStatus = 'stale';
        this.touch();
    }

    /** Registra falha na indexação. */
    failIndexing(): void {
        this._contextStatus = 'error';
        this.touch();
    }

    /** Retorna true se o contexto precisa ser (re)indexado. */
    needsIndexing(): boolean {
        return this._contextStatus === 'pending'
            || this._contextStatus === 'stale'
            || this._contextStatus === 'error';
    }

    private touch(): void {
        this.updatedAt = new Date();
    }
}
