'use client';

import * as React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ClockIcon,
  InboxIcon,
  MagnifyingGlassCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import Paginator from '@/components/paginator';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/option-select';
import { StatCard } from '@/components/stat-card';
import { toast } from 'sonner';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { copyToClipboard } from '@/lib/clipboard';
import { fetchAllFeedback, useFeedbackList, useUpdateFeedbackStatus } from '@/features/feedback/api/feedback';
import { formatFeedbackRequests } from '@/features/feedback/lib/format-request';
import { FeedbackDetailDialog } from '@/features/feedback/components/feedback-detail-dialog';
import { FeedbackTable } from '@/features/feedback/components/feedback-table';
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type Feedback } from '@/features/feedback/types';

export function FeedbackPage() {
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [kind, setKind] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [selected, setSelected] = React.useState<Feedback | null>(null);
  const [copying, setCopying] = React.useState(false);
  const { hasPermission } = useAuth();
  const updateStatus = useUpdateFeedbackStatus();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useFeedbackList({
    page,
    page_size: pageSize,
    q: debouncedSearch || undefined,
    kind: kind || undefined,
    status: status || undefined,
  });

  const counts = data?.status_counts ?? {};

  /** Sao chép toàn bộ góp ý theo bộ lọc hiện tại (không chỉ trang đang xem). */
  const copyAll = async () => {
    setCopying(true);
    try {
      const all = await fetchAllFeedback({
        q: debouncedSearch || undefined,
        kind: kind || undefined,
        status: status || undefined,
      });
      if (all.length === 0) {
        toast.info('Không có góp ý nào để sao chép');
        return;
      }
      const ok = await copyToClipboard(formatFeedbackRequests(all));
      if (ok) toast.success(`Đã sao chép ${all.length} góp ý`);
      else toast.error('Không sao chép được, vui lòng thử lại');
    } catch {
      toast.error('Không lấy được danh sách góp ý');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Mới" value={counts.new ?? 0} icon={InboxIcon} tone="primary" />
        <StatCard label="Đang xem xét" value={counts.reviewing ?? 0} icon={MagnifyingGlassCircleIcon} tone="neutral" />
        <StatCard label="Đã lên kế hoạch" value={counts.planned ?? 0} icon={ClockIcon} tone="neutral" />
        <StatCard label="Hoàn thành" value={counts.done ?? 0} icon={CheckCircleIcon} tone="success" />
        <StatCard label="Từ chối" value={counts.rejected ?? 0} icon={XCircleIcon} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã, tiêu đề, nội dung, người góp ý..."
            className="pl-9"
          />
        </div>
        <OptionSelect
          className="w-[210px]"
          value={kind}
          onChange={(value) => {
            setKind(value);
            setPage(1);
          }}
          emptyLabel="Tất cả loại góp ý"
          options={FEEDBACK_KINDS.map((k) => ({ value: k.value, label: k.label }))}
        />
        <OptionSelect
          className="w-[190px]"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          emptyLabel="Tất cả trạng thái"
          options={FEEDBACK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
        <Button
          variant="outline"
          onClick={() => void copyAll()}
          disabled={copying || !data?.total}
          data-testid="feedback-copy-all"
        >
          <ClipboardDocumentListIcon className="mr-1.5 h-4 w-4" />
          {copying ? 'Đang sao chép...' : `Sao chép tất cả${data?.total ? ` (${data.total})` : ''}`}
        </Button>
      </div>

      <FeedbackTable
        items={data?.data ?? []}
        isLoading={isLoading}
        onOpen={setSelected}
        onToggleDone={
          hasPermission('feedback.item:update')
            ? (f) => updateStatus.mutate({ id: f.id, status: f.status === 'done' ? 'new' : 'done' })
            : undefined
        }
      />

      {data && (
        <Paginator
          currentPage={page}
          pageSize={pageSize}
          totalItems={data.total}
          onPageChange={(p, size) => {
            setPage(p);
            setPageSize(size);
          }}
        />
      )}

      <FeedbackDetailDialog feedback={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
