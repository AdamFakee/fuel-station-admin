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
import { RecentSessionItem } from '../types';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { Empty } from '@/components/empty';

interface RecentSessionsTableProps {
  sessions: RecentSessionItem[];
  isLoading?: boolean;
}

export function RecentSessionsTable({ sessions, isLoading }: RecentSessionsTableProps) {
  if (!isLoading && sessions.length === 0) {
    return (
      <Empty
        title="Chưa có phiên bơm nào"
        description="Chưa ghi nhận giao dịch cấp phát nhiên liệu nào gần đây."
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/50">
            <TableHead className="w-[120px] text-left">Mã phiên</TableHead>
            <TableHead className="text-left">Trụ bơm</TableHead>
            <TableHead className="text-left">Biển số xe</TableHead>
            <TableHead className="text-left">Tài xế</TableHead>
            <TableHead className="text-left">Trạng thái</TableHead>
            <TableHead className="text-right justify-end">Lượng đổ (Lít)</TableHead>
            <TableHead className="text-right justify-end">Thời gian</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((sess) => (
            <TableRow key={sess.id}>
              {/* Mã phiên (font-mono, left) */}
              <TableCell className="font-mono text-xs font-semibold text-primary">
                {sess.code}
              </TableCell>

              {/* Trụ bơm */}
              <TableCell className="text-xs font-medium">
                {sess.pump_name}
              </TableCell>

              {/* Biển số xe */}
              <TableCell className="font-mono text-xs">
                {sess.vehicle_plate || '—'}
              </TableCell>

              {/* Tài xế */}
              <TableCell className="text-xs">
                {sess.driver_name || '—'}
              </TableCell>

              {/* Trạng thái */}
              <TableCell>
                {sess.status === 'completed' && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-normal text-[10px] px-1.5 py-0">
                    Thành công
                  </Badge>
                )}
                {sess.status === 'failed' && (
                  <Badge variant="destructive" className="font-normal text-[10px] px-1.5 py-0">
                    Lỗi
                  </Badge>
                )}
                {sess.status === 'cancelled' && (
                  <Badge variant="outline" className="border-zinc-300 text-zinc-600 font-normal text-[10px] px-1.5 py-0">
                    Đã hủy
                  </Badge>
                )}
              </TableCell>

              {/* Lượng đổ (right, tabular-nums) */}
              <TableCell className="text-right tabular-nums text-xs font-semibold text-foreground">
                {formatNumberVN(sess.dispensed_liters, 2)}
              </TableCell>

              {/* Thời gian (right, tabular-nums) */}
              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                {formatDateTimeVN(sess.finished_at || sess.received_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
