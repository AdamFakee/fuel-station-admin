'use client';

import React from 'react';
import { DispenseReportResponse } from '../types';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Hoàn thành</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Đã hủy</Badge>;
      case 'failed':
        return <Badge variant="destructive">Lỗi</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Tổng số lượt đổ nhiên liệu</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatNumberVN(data?.total_sessions || 0)}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="pt-4">
            <div className="text-xs text-blue-800">Tổng thể tích cấp phát thực tế</div>
            <div className="text-2xl font-bold text-blue-700 tabular-nums mt-1">
              {formatNumberVN(data?.total_dispensed_liters || 0, 2)} L
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Thể tích trung bình / lượt</div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {data?.total_sessions
                ? formatNumberVN((data.total_dispensed_liters || 0) / data.total_sessions, 2)
                : '0'}{' '}
              L
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chi tiết danh sách phiên đổ */}
      <div className="rounded-md border">
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
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Không tìm thấy phiên đổ nhiên liệu nào khớp với bộ lọc.
                </TableCell>
              </TableRow>
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
