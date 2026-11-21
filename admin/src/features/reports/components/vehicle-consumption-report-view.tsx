'use client';

import { TableEmptyRow } from '@/components/table-empty-row';
import { StatCard } from '@/components/stat-card';
import { BeakerIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { StatusBadge } from '@/components/status-badge';
import React from 'react';
import { VehicleConsumptionResponse } from '../types';
import { formatNumberVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface VehicleConsumptionReportViewProps {
  data?: VehicleConsumptionResponse;
  isLoading: boolean;
}

export function VehicleConsumptionReportView({ data, isLoading }: VehicleConsumptionReportViewProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải báo cáo tiêu hao theo xe...</div>;
  }

  const items = data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'over_quota':
        return <StatusBadge tone="danger">Vượt định mức</StatusBadge>;
      case 'normal':
        return <StatusBadge tone="success">Trong định mức</StatusBadge>;
      default:
        return <StatusBadge tone="neutral">Chưa có định mức</StatusBadge>;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Quick Summary Cards */}
      <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          label="Tổng số phương tiện trong danh sách"
          value={<>{formatNumberVN(data?.total_vehicles || 0)}</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Tổng số phiên đổ hoàn thành"
          value={<>{formatNumberVN(data?.total_sessions || 0)}</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Tổng nhiên liệu tiêu thụ toàn đội xe"
          value={<>{formatNumberVN(data?.total_dispensed_liters || 0, 2)} L</>}
          icon={BeakerIcon}
          tone="primary"
        />
      </div>

      {/* Bảng kê tiêu hao theo xe */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">Mã xe</TableHead>
              <TableHead className="w-[130px]">Biển số</TableHead>
              <TableHead>Loại xe</TableHead>
              <TableHead className="text-right tabular-nums">Số lượt đổ</TableHead>
              <TableHead className="text-right tabular-nums text-indigo-600 font-bold">Tổng tiêu hao (L)</TableHead>
              <TableHead className="text-right tabular-nums">Hạn mức quy định (L)</TableHead>
              <TableHead className="text-right tabular-nums">Chênh lệch (L)</TableHead>
              <TableHead className="w-[130px]">Đánh giá</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableEmptyRow colSpan={8} title="Không có dữ liệu tiêu hao phương tiện trong khoảng thời gian đã chọn." />
            ) : (
              items.map((row) => (
                <TableRow key={row.vehicle_id}>
                  <TableCell className="font-mono text-xs font-semibold">{row.vehicle_code}</TableCell>
                  <TableCell className="font-bold text-xs">{row.vehicle_plate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.type_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{row.session_count}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-extrabold text-indigo-600">
                    {formatNumberVN(row.total_dispensed_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {row.quota_liters !== null ? (
                      <div>
                        <span className="font-medium">{formatNumberVN(row.quota_liters, 2)}</span>
                        {row.quota_period && (
                          <span className="text-[10px] text-muted-foreground block">
                            (
                            {row.quota_period === 'day'
                              ? 'ngày'
                              : row.quota_period === 'month'
                                ? 'tháng'
                                : row.quota_period}
                            )
                          </span>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-xs font-semibold ${
                      (row.variance_liters || 0) > 0 ? 'text-destructive' : 'text-emerald-600'
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
