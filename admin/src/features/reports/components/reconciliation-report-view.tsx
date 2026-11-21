'use client';

import { TableEmptyRow } from '@/components/table-empty-row';
import { StatCard } from '@/components/stat-card';
import { BeakerIcon, ChartBarIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { StatusBadge } from '@/components/status-badge';
import React from 'react';
import { ReconciliationReportResponse } from '../types';
import { formatNumberVN, formatDateVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ReconciliationReportViewProps {
  data?: ReconciliationReportResponse;
  isLoading: boolean;
}

export function ReconciliationReportView({ data, isLoading }: ReconciliationReportViewProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải báo cáo đối chiếu kiểm kê...</div>;
  }

  const items = data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <StatusBadge tone="info">Đã chốt</StatusBadge>;
      case 'matched':
        return <StatusBadge tone="success">Khớp sổ</StatusBadge>;
      case 'alert':
        return <StatusBadge tone="danger">Lệch ngưỡng</StatusBadge>;
      default:
        return <StatusBadge tone="warning">Chờ đo</StatusBadge>;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Quick Summary Cards */}
      <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Tổng số biên bản kiểm kê"
          value={<>{formatNumberVN(data?.total_count || 0)}</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Khớp trong dung sai"
          value={<>{formatNumberVN(data?.matched_count || 0)}</>}
          icon={BeakerIcon}
          tone="primary"
        />
        <StatCard
          label="Cảnh báo vượt ngưỡng hao hụt"
          value={<>{formatNumberVN(data?.alert_count || 0)}</>}
          icon={ExclamationTriangleIcon}
          tone="danger"
        />
        <StatCard
          label="Kế toán đã phê duyệt"
          value={<>{formatNumberVN(data?.confirmed_count || 0)}</>}
          icon={CheckCircleIcon}
          tone="success"
        />
      </div>

      {/* Bảng kê đối chiếu kiểm kê */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px] text-right tabular-nums">Ngày kiểm kê</TableHead>
              <TableHead>Bể chứa</TableHead>
              <TableHead>Nhiên liệu</TableHead>
              <TableHead className="text-right tabular-nums">Tồn đầu (L)</TableHead>
              <TableHead className="text-right tabular-nums text-emerald-600">Tổng nhập (L)</TableHead>
              <TableHead className="text-right tabular-nums text-blue-600">Cấp phát (L)</TableHead>
              <TableHead className="text-right tabular-nums font-semibold">Tồn sổ sách (L)</TableHead>
              <TableHead className="text-right tabular-nums font-bold">Thực đo (L)</TableHead>
              <TableHead className="text-right tabular-nums">Chênh lệch (L)</TableHead>
              <TableHead className="text-right tabular-nums">% Lệch</TableHead>
              <TableHead className="w-[120px]">Trạng thái</TableHead>
              <TableHead>Nhân sự thực hiện</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableEmptyRow colSpan={12} title="Không có biên bản kiểm kê nào trong khoảng thời gian đã chọn." />
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-right tabular-nums text-xs font-medium">
                    {formatDateVN(row.period_date)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{row.tank_name}</TableCell>
                  <TableCell className="text-xs">{row.fuel_type_name}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatNumberVN(row.opening_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-emerald-600 font-medium">
                    {formatNumberVN(row.receipts_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-blue-600 font-medium">
                    {formatNumberVN(row.dispensed_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-semibold">
                    {formatNumberVN(row.book_closing_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-extrabold text-foreground">
                    {row.measured_liters !== null ? formatNumberVN(row.measured_liters, 2) : '—'}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-xs font-bold ${
                      (row.variance_liters || 0) < 0 ? 'text-destructive' : 'text-emerald-600'
                    }`}
                  >
                    {row.variance_liters !== null ? (
                      <>
                        {row.variance_liters > 0 ? '+' : ''}
                        {formatNumberVN(row.variance_liters, 2)}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {row.variance_pct !== null
                      ? `${row.variance_pct > 0 ? '+' : ''}${formatNumberVN(row.variance_pct, 2)}%`
                      : '—'}
                  </TableCell>
                  <TableCell>{getStatusBadge(row.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.measured_by_name && <div>Đo: {row.measured_by_name}</div>}
                    {row.confirmed_by_name && (
                      <div className="text-[11px] text-emerald-700 font-medium">Duyệt: {row.confirmed_by_name}</div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
