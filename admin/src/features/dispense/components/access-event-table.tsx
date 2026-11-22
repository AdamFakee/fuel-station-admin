'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { accessEventDetail } from '@/lib/row-details';
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
  BannedVehicle: 'Phương tiện bị cấm bơm',
  BannedDriver: 'Tài xế bị tạm đình chỉ',
};

export function AccessEventTable({ events, isLoading }: AccessEventTableProps) {
  const [detail, setDetail] = React.useState<AccessEventListItem | null>(null);
  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Đang tải nhật ký xác thực...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
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
            <TableHead className="text-left w-[130px]">Trạm xăng</TableHead>
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
              <TableRow key={e.id} className="hover:bg-muted/40 transition-colors" onClick={rowClick(() => setDetail(e))}>
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
                  <StatusBadge tone={isReject ? 'danger' : 'success'}>{isReject ? 'Bị từ chối' : 'Hợp lệ'}</StatusBadge>
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
      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={'Lượt xác thực'}
        description={undefined}
        sections={detail ? accessEventDetail(detail) : []}
      />
    </div>
  );
}
