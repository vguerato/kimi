import { Chip, Spinner } from '@heroui/react';
import { Check, Clock, AlertCircle, Database } from 'lucide-react';
import type { RepoStatus } from '../types';

interface RepoStatusBadgeProps {
  status: RepoStatus | undefined;
}

/**
 * Badge de status de repositório.
 *
 * No v2, o status reflete a indexação de contexto (não clone local):
 *   ready   → contexto indexado, agente pode usar
 *   pending → aguardando primeira indexação
 *   error   → falha na indexação
 *   cloning → legado, não usado no v2
 */
export function RepoStatusBadge({ status }: RepoStatusBadgeProps) {
  if (status === 'ready') return (
    <Chip size="sm" variant="soft" color="success">
      <span className="inline-flex items-center gap-1">
        <Check size={11} />
        Indexado
      </span>
    </Chip>
  );

  if (status === 'cloning') return (
    <Chip size="sm" variant="soft" color="warning">
      <span className="inline-flex items-center gap-1">
        <Spinner size="sm" color="current" />
        Indexando...
      </span>
    </Chip>
  );

  if (status === 'error') return (
    <Chip size="sm" variant="soft" color="danger">
      <span className="inline-flex items-center gap-1">
        <AlertCircle size={11} />
        Erro
      </span>
    </Chip>
  );

  // pending ou undefined
  return (
    <Chip size="sm" variant="soft" color="default">
      <span className="inline-flex items-center gap-1">
        <Clock size={11} />
        Pendente
      </span>
    </Chip>
  );
}
