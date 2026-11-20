'use client';

import React from 'react';
import { VehicleConsumptionResponse } from '../types';
import { formatNumberVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
        return <Badge variant="destructive">Vượt định mức</Badge>;
      case 'normal':
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Trong định mức</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Chưa có định mức</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Tổng số phương tiện trong danh sách</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatNumberVN(data?.total_vehicles || 0)}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Tổng số phiên đổ hoàn thành</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatNumberVN(data?.total_sessions || 0)}</div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50/50 border-indigo-100">
          <CardContent className="pt-4">
            <div className="text-xs text-indigo-800">Tổng nhiên liệu tiêu thụ toàn đội xe</div>
            <div className="text-2xl font-bold text-indigo-700 tabular-nums mt-1">
              {formatNumberVN(data?.total_dispensed_liters || 0, 2)} L
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bảng kê tiêu hao theo xe */}
      <div className="rounded-md border">
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
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Không có dữ liệu tiêu hao phương tiện trong khoảng thời gian đã chọn.
                </TableCell>
              </TableRow>
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
                            ({row.quota_period === 'day' ? 'ngày' : row.quota_period === 'month' ? 'tháng' : row.quota_period})
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
