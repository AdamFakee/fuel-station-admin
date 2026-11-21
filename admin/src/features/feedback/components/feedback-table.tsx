'use client';

import * as React from 'react';
import { CheckCircleIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import {
  ACTION_CELL_CLASS,
  ACTION_HEAD_CLASS,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableEmptyRow } from '@/components/table-empty-row';
import { formatDateTimeVN } from '@/lib/format';
import { rowClick } from '@/lib/row-click';
import type { Feedback } from '../types';
import { KindBadge, StatusLabelBadge } from './feedback-badges';
import { copyFeedbackRequest } from './feedback-detail-dialog';

interface FeedbackTableProps {
  items: Feedback[];
  isLoading: boolean;
  onOpen: (feedback: Feedback) => void;
  /** Có thì hiện nút tick để đánh dấu đã xong / chưa xong ngay trên dòng (cần quyền sửa). */
  onToggleDone?: (feedback: Feedback) => void;
}

/** Đường dẫn của trang góp ý (bỏ phần địa chỉ máy chủ cho gọn). */
function pagePath(url?: string): string {
  if (!url) return '—';
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export function FeedbackTable({ items, isLoading, onOpen, onToggleDone }: FeedbackTableProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[130px] text-left">Mã</TableHead>
            <TableHead className="w-[170px] text-left">Loại</TableHead>
            <TableHead className="text-left">Tiêu đề</TableHead>
            <TableHead className="w-[200px] text-left">Trang / Phần tử</TableHead>
            <TableHead className="w-[170px] text-left">Người góp ý</TableHead>
            <TableHead className="w-[140px] text-left">Trạng thái</TableHead>
            <TableHead className="w-[160px] text-right tabular-nums">Thời gian</TableHead>
            <TableHead className={`${ACTION_HEAD_CLASS} w-[110px]`}>Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableEmptyRow colSpan={8} loading title="Đang tải danh sách góp ý..." />
          ) : items.length === 0 ? (
            <TableEmptyRow
              colSpan={8}
              title="Chưa có góp ý nào"
              description="Góp ý do người dùng gửi qua nút Góp ý ở góc màn hình sẽ hiện ở đây."
            />
          ) : (
            items.map((f) => (
              <TableRow key={f.id} onClick={rowClick(() => onOpen(f))} data-testid={`feedback-row-${f.code}`}>
                <TableCell className="font-mono text-xs font-semibold text-left">{f.code}</TableCell>
                <TableCell className="text-left">
                  <KindBadge kind={f.kind} />
                </TableCell>
                <TableCell className="max-w-[360px] text-left">
                  <p className="truncate text-sm font-medium" title={f.title}>
                    {f.title}
                  </p>
                </TableCell>
                <TableCell className="max-w-[200px] text-left">
                  <p className="truncate text-xs text-muted-foreground" title={f.page_url}>
                    {pagePath(f.page_url)}
                  </p>
                  {f.element && (
                    <p className="truncate font-mono text-[11px] text-muted-foreground" title={f.element.selector}>
                      &lt;{f.element.tag}&gt; {f.element.text?.slice(0, 24)}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-left text-sm">{f.created_by_name}</TableCell>
                <TableCell className="text-left">
                  <StatusLabelBadge status={f.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                  {formatDateTimeVN(f.created_at)}
                </TableCell>
                <TableCell className={ACTION_CELL_CLASS}>
                  <div className="flex justify-end gap-1">
                    {onToggleDone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={
                          f.status === 'done'
                            ? 'h-8 w-8 text-emerald-600'
                            : 'h-8 w-8 text-muted-foreground hover:text-emerald-600'
                        }
                        title={f.status === 'done' ? 'Đã xong, bấm để mở lại' : 'Đánh dấu đã xong'}
                        onClick={() => onToggleDone(f)}
                        data-testid={`feedback-tick-${f.code}`}
                      >
                        {f.status === 'done' ? (
                          <CheckCircleSolid className="h-5 w-5" />
                        ) : (
                          <CheckCircleIcon className="h-5 w-5" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Sao chép yêu cầu đầy đủ"
                      onClick={() => void copyFeedbackRequest(f)}
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
