/**
 * Status de um repositório configurado.
 *
 * No backend v2, repositórios não são clonados localmente.
 * O status reflete se o contexto do projeto foi indexado na memória:
 *   'ready'   → contexto indexado e disponível para o agente
 *   'pending' → repositório configurado mas ainda não indexado
 *   'error'   → falha na indexação (mantido para compatibilidade)
 *   'cloning' → não usado no v2, mantido para compatibilidade de tipo
 */
export type RepoStatus = 'ready' | 'pending' | 'error' | 'cloning';

export interface RepoMapping {
    prefix: string;
    url: string;
}

export type RepoStatusMap = Record<string, RepoStatus>;
