'use client';

import { rowClick } from '@/lib/row-click';
import { StatusBadge } from '@/components/status-badge';
import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EyeIcon } from '@heroicons/react/24/outline';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { DispenseSessionListItem } from '../types';

interface SessionTableProps {
  sessions: DispenseSessionListItem[];
  isLoading: boolean;
  onViewDetail: (session: DispenseSessionListItem) => void;
}

export function SessionTable({ sessions, isLoading, onViewDetail }: SessionTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Đang tải danh sách phiên bơm...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Không có phiên bơm nào phù hợp với điều kiện tìm kiếm.
      </div>
    );
  }

  const statusBadge = (status: string, edgeState: string) => {
    switch (status) {
      case 'completed':
        return <StatusBadge tone="success">Hoàn thành</StatusBadge>;
      case 'cancelled':
        return <StatusBadge tone="neutral">Đã hủy ({edgeState === 'timed_out' ? 'Hết giờ' : 'Hủy bỏ'})</StatusBadge>;
      case 'failed':
        return <StatusBadge tone="danger">Lỗi bơm</StatusBadge>;
      default:
        return <StatusBadge tone="neutral">{status}</StatusBadge>;
    }
  };

  return (
    <div className="rounded-md border bg-card overflow-hidden flex min-h-0 flex-1 flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px] text-left">Mã giao dịch</TableHead>
            <TableHead className="text-left w-[130px]">Trụ / Bể</TableHead>
            <TableHead className="text-left">Phương tiện (Xe)</TableHead>
            <TableHead className="text-left">Tài xế</TableHead>
            <TableHead className="text-right tabular-nums w-[120px] text-blue-600">Đã đổ (Lít)</TableHead>
            <TableHead className="text-left w-[120px]">Trạng thái</TableHead>
            <TableHead className="text-right tabular-nums w-[170px]">Thời điểm hoàn tất</TableHead>
            <TableHead className="text-right w-[80px]">Chi tiết</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => (
            <TableRow key={s.id} className="hover:bg-muted/40 transition-colors" onClick={rowClick(() => onViewDetail(s))}>
              <TableCell className="font-mono text-xs font-semibold text-foreground text-left">
                {s.code}
              </TableCell>
              <TableCell className="text-left">
                <div className="font-medium text-xs text-foreground">{s.pump_name}</div>
                <div className="text-[11px] text-muted-foreground">{s.tank_name || s.branch_name}</div>
              </TableCell>
              <TableCell className="text-left">
                <div className="font-medium text-xs text-foreground">{s.vehicle_plate || '—'}</div>
                {s.vehicle_code && (
                  <div className="text-[11px] font-mono text-muted-foreground">({s.vehicle_code})</div>
                )}
              </TableCell>
              <TableCell className="text-left">
                <div className="font-medium text-xs text-foreground">{s.driver_name || '—'}</div>
                {s.driver_code && (
                  <div className="text-[11px] font-mono text-muted-foreground">({s.driver_code})</div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs font-semibold text-blue-600">
                {formatNumberVN(s.dispensed_liters, 2)} L
              </TableCell>
              <TableCell className="text-left">
                {statusBadge(s.status, s.edge_state)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                {formatDateTimeVN(s.finished_at || s.started_at || s.received_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary hover:text-primary"
                    onClick={() => onViewDetail(s)}
                    title="Xem chi tiết phiên đổ"
                  >
                    <EyeIcon className="h-4 w-4" />
                    <span className="sr-only">Xem chi tiết</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
