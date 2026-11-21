'use client';

import { TableEmptyRow } from '@/components/table-empty-row';
import { StatCard } from '@/components/stat-card';
import { BeakerIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { StatusBadge } from '@/components/status-badge';
import React from 'react';
import { DispenseReportResponse } from '../types';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DispensesReportViewProps {
  data?: DispenseReportResponse;
  isLoading: boolean;
}

export function DispensesReportView({ data, isLoading }: DispensesReportViewProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải lịch sử cấp phát...</div>;
  }

  const items = data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <StatusBadge tone="success">Hoàn thành</StatusBadge>;
      case 'cancelled':
        return <StatusBadge tone="neutral">Đã hủy</StatusBadge>;
      case 'failed':
        return <StatusBadge tone="danger">Lỗi</StatusBadge>;
      default:
        return <StatusBadge tone="neutral">{status}</StatusBadge>;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Quick Summary Cards */}
      <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          label="Tổng số lượt đổ nhiên liệu"
          value={<>{formatNumberVN(data?.total_sessions || 0)}</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Tổng thể tích cấp phát thực tế"
          value={<>{formatNumberVN(data?.total_dispensed_liters || 0, 2)} L</>}
          icon={BeakerIcon}
          tone="primary"
        />
        <StatCard
          label="Thể tích trung bình / lượt"
          value={
            <>
              {data?.total_sessions ? formatNumberVN((data.total_dispensed_liters || 0) / data.total_sessions, 2) : '0'}{' '}
              L
            </>
          }
          icon={ChartBarIcon}
          tone="neutral"
        />
      </div>

      {/* Chi tiết danh sách phiên đổ */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[130px]">Mã phiên</TableHead>
              <TableHead className="w-[160px] text-right tabular-nums">Thời điểm đổ</TableHead>
              <TableHead>Trụ bơm</TableHead>
              <TableHead>Bể xuất</TableHead>
              <TableHead>Nhiên liệu</TableHead>
              <TableHead>Biển số xe</TableHead>
              <TableHead>Tài xế</TableHead>
              <TableHead className="text-right tabular-nums text-blue-600 font-semibold">Lít thực đổ (L)</TableHead>
              <TableHead className="text-right tabular-nums">Số đồng hồ tổng (L)</TableHead>
              <TableHead className="text-right tabular-nums w-[80px]">Số lần</TableHead>
              <TableHead className="w-[110px]">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableEmptyRow colSpan={11} title="Không tìm thấy phiên đổ nhiên liệu nào khớp với bộ lọc." />
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs font-semibold">{row.code}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatDateTimeVN(row.finished_at || row.started_at)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{row.pump_name}</TableCell>
                  <TableCell className="text-xs">{row.tank_name || '—'}</TableCell>
                  <TableCell className="text-xs">{row.fuel_type_name || '—'}</TableCell>
                  <TableCell className="text-xs font-bold">{row.vehicle_plate || '—'}</TableCell>
                  <TableCell className="text-xs">{row.driver_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-blue-600 font-extrabold">
                    {formatNumberVN(row.dispensed_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {row.pump_total_liters !== null ? formatNumberVN(row.pump_total_liters, 2) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {row.sale_seq || '—'}
                  </TableCell>
                  <TableCell>{getStatusBadge(row.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
