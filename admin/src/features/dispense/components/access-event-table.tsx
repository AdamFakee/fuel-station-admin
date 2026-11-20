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
import { formatDateTimeVN } from '@/lib/format';
import { AccessEventListItem } from '../types';

interface AccessEventTableProps {
  events: AccessEventListItem[];
  isLoading: boolean;
}

const REASON_TRANSLATIONS: Record<string, string> = {
  Blocked: 'Thẻ/Đối tượng bị khóa',
  WrongKind: 'Sai loại thẻ (Quẹt thẻ xe vào máy tài xế hoặc ngược lại)',
  Expired: 'Thẻ hoặc quyền đã hết hạn',
  Unknown: 'Không tìm thấy thông tin trên hệ thống',
  UnknownCard: 'Mã thẻ lạ chưa được khai báo',
  NoQuota: 'Hết hạn mức nhiên liệu khả dụng',
  BannedVehicle: 'Phương tiện bị cấm bơm',
  BannedDriver: 'Tài xế bị tạm đình chỉ',
};

export function AccessEventTable({ events, isLoading }: AccessEventTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Đang tải nhật ký xác thực...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Không có dữ liệu xác thực nào phù hợp.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden flex min-h-0 flex-1 flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[170px] text-left">Thời điểm</TableHead>
            <TableHead className="text-left w-[130px]">Chi nhánh</TableHead>
            <TableHead className="text-left w-[120px]">Phương thức</TableHead>
            <TableHead className="text-left">Mã định danh / Thẻ</TableHead>
            <TableHead className="text-left">Đối tượng nhận diện</TableHead>
            <TableHead className="text-left w-[120px]">Kết quả</TableHead>
            <TableHead className="text-left">Lý do từ chối / Ghi chú</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => {
            const isReject = e.decision === 'reject';
            return (
              <TableRow key={e.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="tabular-nums text-xs text-muted-foreground text-left">
                  {formatDateTimeVN(e.occurred_at, true)}
                </TableCell>
                <TableCell className="text-left text-xs font-medium">
                  {e.branch_name}
                </TableCell>
                <TableCell className="text-left">
                  <Badge variant="outline" className="text-xs uppercase font-semibold">
                    {e.method === 'card'
                      ? 'Thẻ NFC'
                      : e.method === 'face'
                      ? 'Khuôn mặt'
                      : e.method === 'fingerprint'
                      ? 'Vân tay'
                      : e.kind}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold text-foreground text-left">
                  {e.external_id || '—'}
                </TableCell>
                <TableCell className="text-left text-xs">
                  <div className="font-medium text-foreground">
                    {e.party_name || e.driver_name || e.vehicle_plate || 'Chưa định danh'}
                  </div>
                  {e.vehicle_plate && e.party_name !== e.vehicle_plate && (
                    <span className="text-[11px] text-muted-foreground font-mono block">
                      Xe: {e.vehicle_plate}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-left">
                  {isReject ? (
                    <Badge variant="destructive" className="text-xs font-normal">
                      Bị từ chối
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-normal"
                    >
                      Hợp lệ
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-left text-xs">
                  {e.reason ? (
                    <span className="font-medium text-destructive">
                      {REASON_TRANSLATIONS[e.reason] || e.reason}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
