import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { kindLabel, statusLabel } from '../types';

const KIND_TONE: Record<string, StatusTone> = {
  improvement: 'info',
  ui_ux: 'neutral',
  bug: 'danger',
  business: 'warning',
};

const STATUS_TONE: Record<string, StatusTone> = {
  new: 'warning',
  reviewing: 'info',
  planned: 'info',
  done: 'success',
  rejected: 'neutral',
};

export function KindBadge({ kind }: { kind: string }) {
  return <StatusBadge tone={KIND_TONE[kind] ?? 'neutral'}>{kindLabel(kind)}</StatusBadge>;
}

export function StatusLabelBadge({ status }: { status: string }) {
  return <StatusBadge tone={STATUS_TONE[status] ?? 'neutral'}>{statusLabel(status)}</StatusBadge>;
}
