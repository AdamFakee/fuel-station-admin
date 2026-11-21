'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ClipboardDocumentIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptionSelect } from '@/components/option-select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { copyToClipboard } from '@/lib/clipboard';
import { formatDateTimeVN } from '@/lib/format';
import { useDeleteFeedback, useUpdateFeedbackStatus } from '../api/feedback';
import { formatFeedbackRequest } from '../lib/format-request';
import { FEEDBACK_STATUSES, type Feedback, type FeedbackStatus } from '../types';
import { KindBadge, StatusLabelBadge } from './feedback-badges';

interface FeedbackDetailDialogProps {
  feedback: Feedback | null;
  onOpenChange: (open: boolean) => void;
}

export async function copyFeedbackRequest(feedback: Feedback) {
  const ok = await copyToClipboard(formatFeedbackRequest(feedback));
  if (ok) toast.success(`Đã sao chép yêu cầu ${feedback.code}`);
  else toast.error('Không sao chép được, vui lòng thử lại');
}

export function FeedbackDetailDialog({ feedback, onOpenChange }: FeedbackDetailDialogProps) {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('feedback.item:update');
  const canDelete = hasPermission('feedback.item:delete');
  const updateStatus = useUpdateFeedbackStatus();
  const deleteFeedback = useDeleteFeedback();

  const [status, setStatus] = React.useState<FeedbackStatus>('new');
  const [note, setNote] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (feedback) {
      setStatus(feedback.status);
      setNote(feedback.resolution_note ?? '');
    }
  }, [feedback]);

  if (!feedback) return null;
  const element = feedback.element;
  const changed = status !== feedback.status || note.trim() !== (feedback.resolution_note ?? '');

  const save = () => {
    if (status === 'rejected' && !note.trim()) {
      toast.error('Cần nêu lý do khi từ chối góp ý');
      return;
    }
    updateStatus.mutate({ id: feedback.id, status, resolution_note: note.trim() || undefined }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{feedback.title}</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{feedback.code}</span> · {feedback.created_by_name} ({feedback.created_by_role}) ·{' '}
              {formatDateTimeVN(feedback.created_at)}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <KindBadge kind={feedback.kind} />
              <StatusLabelBadge status={feedback.status} />
            </div>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nội dung góp ý</h3>
              <p className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm leading-relaxed">{feedback.description}</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ngữ cảnh</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border bg-card p-5 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Trang</dt>
                  <dd className="break-all text-sm font-medium">{feedback.page_url || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs text-muted-foreground">Kích thước cửa sổ</dt>
                  <dd className="text-sm font-medium">{feedback.viewport ? `${feedback.viewport.width} × ${feedback.viewport.height}` : '—'}</dd>
                </div>
                {element && (
                  <>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">Phần tử đã chọn</dt>
                      <dd className="text-sm font-medium">
                        &lt;{element.tag}&gt;
                        {element.text && <span className="font-normal text-muted-foreground"> “{element.text.slice(0, 80)}”</span>}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">Thành phần React</dt>
                      <dd className="text-sm font-medium">{element.component || '—'}</dd>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Selector</dt>
                      <dd className="break-all font-mono text-xs">{element.selector}</dd>
                    </div>
                  </>
                )}
              </dl>
              {element && (
                <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">{element.html}</pre>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Xử lý</h3>
              {canUpdate ? (
                <div className="space-y-3 rounded-lg border bg-card p-5">
                  <div className="space-y-1.5">
                    <Label>Trạng thái</Label>
                    <OptionSelect
                      value={status}
                      onChange={(value) => setStatus(value as FeedbackStatus)}
                      options={FEEDBACK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="feedback-note">Ghi chú xử lý</Label>
                    <Textarea
                      id="feedback-note"
                      value={note}
                      rows={3}
                      placeholder={status === 'rejected' ? 'Bắt buộc: lý do từ chối' : 'Kế hoạch, kết quả hoặc lý do'}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border bg-card p-4 text-sm">{feedback.resolution_note || 'Chưa có ghi chú xử lý.'}</p>
              )}
            </section>
          </DialogBody>

          <DialogFooter className="sm:justify-between">
            <div>
              {canDelete && (
                <Button type="button" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                  <TrashIcon className="mr-1.5 h-4 w-4" />
                  Xóa
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => void copyFeedbackRequest(feedback)} data-testid="feedback-copy">
                <ClipboardDocumentIcon className="mr-1.5 h-4 w-4" />
                Sao chép yêu cầu
              </Button>
              {canUpdate && (
                <Button type="button" onClick={save} disabled={!changed || updateStatus.isPending}>
                  {updateStatus.isPending ? 'Đang lưu...' : 'Lưu'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xóa góp ý"
        description={`Xóa góp ý ${feedback.code}? Thao tác này không hoàn tác được.`}
        confirmText="Xóa"
        level="destructive"
        loading={deleteFeedback.isPending}
        onConfirm={() => deleteFeedback.mutate(feedback.id, { onSuccess: () => { setConfirmDelete(false); onOpenChange(false); } })}
      />
    </>
  );
}
