'use client';

import { TableEmptyRow } from '@/components/table-empty-row';
import { StatCard } from '@/components/stat-card';
import { ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import React from 'react';
import { DriverDispenseResponse } from '../types';
import { formatNumberVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DriverDispenseReportViewProps {
  data?: DriverDispenseResponse;
  isLoading: boolean;
}

export function DriverDispenseReportView({ data, isLoading }: DriverDispenseReportViewProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải báo cáo cấp phát theo tài xế...</div>;
  }

  const items = data?.items || [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Quick Summary Cards */}
      <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          label="Tổng số tài xế nhận nhiên liệu"
          value={<>{formatNumberVN(data?.total_drivers || 0)}</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Tổng số lượt đổ hoàn tất"
          value={<>{formatNumberVN(data?.total_sessions || 0)}</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Tổng nhiên liệu cấp cho tài xế"
          value={<>{formatNumberVN(data?.total_dispensed_liters || 0, 2)} L</>}
          icon={CheckCircleIcon}
          tone="success"
        />
      </div>

      {/* Bảng kê cấp phát theo tài xế */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">Mã nhân viên</TableHead>
              <TableHead>Họ và tên tài xế</TableHead>
              <TableHead>Số điện thoại</TableHead>
              <TableHead className="text-right tabular-nums">Số lượt nhận</TableHead>
              <TableHead className="text-right tabular-nums text-emerald-600 font-bold">Tổng số lít (L)</TableHead>
              <TableHead className="text-right tabular-nums">TB / lượt (L)</TableHead>
              <TableHead>Phương tiện đã vận hành</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableEmptyRow colSpan={7} title="Không có dữ liệu cấp phát tài xế trong khoảng thời gian đã chọn." />
            ) : (
              items.map((row) => (
                <TableRow key={row.driver_id}>
                  <TableCell className="font-mono text-xs font-semibold">{row.driver_code}</TableCell>
                  <TableCell className="font-semibold text-xs">{row.driver_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.phone || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{row.session_count}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-extrabold text-emerald-600">
                    {formatNumberVN(row.total_dispensed_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium text-slate-700">
                    {formatNumberVN(row.avg_liters_per_session, 2)}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{row.vehicles_used || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
