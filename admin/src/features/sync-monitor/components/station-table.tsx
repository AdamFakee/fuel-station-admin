'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { EdgeStationStatus } from '../types';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { Empty } from '@/components/empty';
import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { stationDetail } from '@/lib/row-details';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useIssueApiKey } from '../api/issue-api-key';
import { useRevokeApiKey } from '../api/revoke-api-key';
import { IssuedKeyDialog } from './issued-key-dialog';
import { IssuedApiKey } from '../types';

interface StationTableProps {
  stations: EdgeStationStatus[];
  isLoading?: boolean;
}

export function StationTable({ stations, isLoading }: StationTableProps) {
  const [detail, setDetail] = React.useState<EdgeStationStatus | null>(null);
  const [issued, setIssued] = React.useState<IssuedApiKey | null>(null);
  const [reissueFor, setReissueFor] = React.useState<EdgeStationStatus | null>(null);
  const [revokeFor, setRevokeFor] = React.useState<EdgeStationStatus | null>(null);
  const { hasPermission } = useAuth();
  const canManageKey = hasPermission('sync.monitor:update');
  const issueKey = useIssueApiKey();
  const revokeKey = useRevokeApiKey();

  const runIssue = (st: EdgeStationStatus) =>
    issueKey.mutate(st.branch_id, {
      onSuccess: (result) => {
        setReissueFor(null);
        setIssued(result);
      },
    });

  if (!isLoading && stations.length === 0) {
    return (
      <Empty
        title="Chưa có trạm Edge nào"
        description="Chưa có trạm Edge Agent nào được cấu hình cho trạm xăng này."
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/50">
            <TableHead className="w-[120px] text-left">Mã trạm</TableHead>
            <TableHead className="text-left">Tên trạm / Thiết bị</TableHead>
            <TableHead className="text-left">Trạm xăng trực thuộc</TableHead>
            <TableHead className="text-left">Khóa API</TableHead>
            <TableHead className="text-left">Trạng thái kết nối</TableHead>
            <TableHead className="text-right justify-end">Lần thấy cuối (Heartbeat)</TableHead>
            <TableHead className="text-right justify-end">Lần đồng bộ cuối</TableHead>
            <TableHead className="text-right justify-end">Hàng đợi</TableHead>
            <TableHead className="text-left">Phiên bản</TableHead>
            <TableHead className="text-left">Nhật ký lỗi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stations.map((st) => (
            <TableRow key={st.branch_id} className="hover:bg-muted/20" onClick={rowClick(() => setDetail(st))}>
              {/* Mã trạm (font-mono, left) */}
              <TableCell className="font-mono text-xs font-semibold text-primary">
                {st.code || '—'}
              </TableCell>

              {/* Tên trạm */}
              <TableCell className="font-medium">
                {st.has_station ? st.name : <span className="font-normal text-muted-foreground">Chưa có trạm Edge</span>}
              </TableCell>

              {/* Trạm xăng */}
              <TableCell className="text-muted-foreground text-xs">
                {st.branch_name} ({st.branch_code})
              </TableCell>

              {/* Khóa API: trạng thái, và nút cấp, cấp lại, thu hồi cho người có quyền */}
              <TableCell>
                <div className="flex items-center gap-2" data-row-action>
                  {st.has_api_key ? (
                    <StatusBadge tone="success">Đang hiệu lực</StatusBadge>
                  ) : st.has_station ? (
                    <StatusBadge tone="neutral">Đã thu hồi</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Chưa cấp</StatusBadge>
                  )}
                  {canManageKey &&
                    (st.has_api_key ? (
                      <>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setReissueFor(st)}>
                          Cấp lại
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => setRevokeFor(st)}>
                          Thu hồi
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="h-7 px-2 text-xs" disabled={issueKey.isPending} onClick={() => runIssue(st)}>
                        Cấp khóa
                      </Button>
                    ))}
                </div>
              </TableCell>

              {/* Trạng thái kết nối: Online vs Offline */}
              <TableCell>
                {st.is_online ? (
                  <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-normal">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1.5 border-zinc-300 bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 font-normal">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    Offline
                  </Badge>
                )}
              </TableCell>

              {/* Lần thấy cuối (right, tabular-nums) */}
              <TableCell className="text-right tabular-nums text-xs">
                {formatDateTimeVN(st.last_seen_at)}
              </TableCell>

              {/* Lần đồng bộ cuối (right, tabular-nums) */}
              <TableCell className="text-right tabular-nums text-xs">
                {formatDateTimeVN(st.last_sync_at)}
              </TableCell>

              {/* Hàng đợi chờ gửi (right, tabular-nums, cảnh báo nếu > 0) */}
              <TableCell className="text-right tabular-nums">
                <span
                  className={
                    st.pending_queue > 0
                      ? 'font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-xs'
                      : 'text-muted-foreground text-xs'
                  }
                >
                  {formatNumberVN(st.pending_queue)}
                </span>
              </TableCell>

              {/* Phiên bản agent */}
              <TableCell className="font-mono text-xs text-muted-foreground">
                {st.agent_version || '—'}
              </TableCell>

              {/* Lỗi gần nhất */}
              <TableCell>
                {st.last_error ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-destructive cursor-pointer max-w-[180px] truncate text-xs">
                          <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{st.last_error}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[320px] p-2 text-xs bg-popover text-popover-foreground shadow-md">
                        <p className="font-semibold text-destructive mb-1">Chi tiết lỗi gần nhất:</p>
                        <p className="font-mono text-[11px] whitespace-pre-wrap">{st.last_error}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500/70" />
                    <span>Bình thường</span>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <IssuedKeyDialog issued={issued} onClose={() => setIssued(null)} />

      <ConfirmDialog
        open={reissueFor !== null}
        onOpenChange={(open) => !open && setReissueFor(null)}
        level="security"
        title="Cấp lại khóa API"
        description={reissueFor ? `Trạm ${reissueFor.code} (${reissueFor.branch_name})` : undefined}
        consequences={[
          'Khóa cũ mất hiệu lực ngay lập tức.',
          'Trạm mất kết nối với server cho đến khi bạn đặt khóa mới vào mini server.',
          'Dữ liệu chưa gửi vẫn nằm trong hàng đợi của trạm và tự gửi bù khi kết nối lại.',
        ]}
        confirmText="Cấp lại khóa"
        loading={issueKey.isPending}
        onConfirm={() => reissueFor && runIssue(reissueFor)}
      />

      <ConfirmDialog
        open={revokeFor !== null}
        onOpenChange={(open) => !open && setRevokeFor(null)}
        level="security"
        title="Thu hồi khóa API"
        description={revokeFor ? `Trạm ${revokeFor.code} (${revokeFor.branch_name})` : undefined}
        consequences={[
          'Khóa hiện tại mất hiệu lực ngay, trạm chuyển sang ngừng hoạt động.',
          'Trạm không đẩy được dữ liệu lên server cho đến khi cấp khóa mới.',
        ]}
        confirmText="Thu hồi"
        loading={revokeKey.isPending}
        onConfirm={() => revokeFor && revokeKey.mutate(revokeFor.branch_id, { onSuccess: () => setRevokeFor(null) })}
      />

      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.name ?? ''}
        sections={detail ? stationDetail(detail) : []}
      />
    </div>
  );
}
