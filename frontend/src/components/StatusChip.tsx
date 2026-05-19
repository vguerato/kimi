import { Chip, Spinner } from '@heroui/react';

interface StatusChipProps {
  status: string;
}

// HeroUI v3 Chip valid colors: 'default' | 'danger' | 'success' | 'warning' | 'accent'
// HeroUI v3 Chip valid variants: 'primary' | 'secondary' | 'tertiary' | 'soft'
type HeroChipColor = 'default' | 'danger' | 'success' | 'warning' | 'accent';

const STATUS_MAP: Record<string, { color: HeroChipColor; label: string; spinner?: boolean }> = {
  'em fila':     { color: 'accent',  label: 'Em Fila' },
  'processando': { color: 'default', label: 'Processando', spinner: true },
  'em espera':   { color: 'warning', label: 'Em Espera' },
  'concluido':   { color: 'success', label: 'Concluído' },
  'error':       { color: 'danger',  label: 'Erro' },
};

export function StatusChip({ status }: StatusChipProps) {
  const cfg = STATUS_MAP[status?.toLowerCase()];

  if (!cfg) {
    return (
      <Chip size="sm" variant="soft" color="default">
        {status}
      </Chip>
    );
  }

  return (
    <Chip size="sm" variant="soft" color={cfg.color}>
      <span className="inline-flex items-center gap-1.5">
        {cfg.spinner && <Spinner size="sm" color="current" />}
        {cfg.label}
      </span>
    </Chip>
  );
}
