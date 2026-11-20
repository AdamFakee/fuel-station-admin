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
import { QuotaExtra } from '../types';

interface QuotaExtraTableProps {
  extras: QuotaExtra[];
  isLoading?: boolean;
}

export function QuotaExtraTable({ extras, isLoading }: QuotaExtraTableProps) {
  const formatLiters = (liters: number) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).format(liters);
  };

  const formatDateTimeVN = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Đang tải lịch sử cấp bổ sung hạn mức...
      </div>
    );
  }

  if (extras.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Chưa có lượt cấp bổ sung hạn mức đột xuất nào.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px] text-left">Phương tiện (Xe)</TableHead>
            <TableHead className="w-[140px] text-right">Lít bổ sung</TableHead>
            <TableHead className="w-[260px] text-left">Thời gian hiệu lực</TableHead>
            <TableHead className="text-left">Lý do cấp bổ sung</TableHead>
            <TableHead className="w-[160px] text-left">Người phê duyệt</TableHead>
            <TableHead className="w-[140px] text-left">Thời điểm cấp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extras.map((extra) => (
            <TableRow key={extra.id}>
              {/* Xe */}
              <TableCell className="text-left">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-foreground">
                    {extra.vehicle_plate}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {extra.vehicle_code}
                  </span>
                </div>
              </TableCell>

              {/* Số lít bổ sung (Căn phải) */}
              <TableCell className="text-right font-mono font-bold text-primary">
                +{formatLiters(extra.extra_volume_liters)} L
              </TableCell>

              {/* Thời gian hiệu lực */}
              <TableCell className="text-left text-xs font-mono text-muted-foreground">
                <div>{formatDateTimeVN(extra.valid_from)}</div>
                <div className="text-[11px] text-muted-foreground/80">đến {formatDateTimeVN(extra.valid_to)}</div>
              </TableCell>

              {/* Lý do */}
              <TableCell className="text-left text-sm text-foreground">
                <p className="line-clamp-2">{extra.reason}</p>
              </TableCell>

              {/* Người cấp */}
              <TableCell className="text-left text-xs text-foreground">
                <Badge variant="outline" className="font-normal text-xs">
                  {extra.granted_by_name || 'Quản lý'}
                </Badge>
              </TableCell>

              {/* Thời điểm tạo */}
              <TableCell className="text-left text-xs text-muted-foreground font-mono">
                {formatDateTimeVN(extra.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
