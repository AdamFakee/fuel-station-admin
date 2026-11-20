'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ClockIcon,
  TruckIcon,
  UserIcon,
  AdjustmentsHorizontalIcon,
  CircleStackIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { useSession } from '../api/get-session';

interface SessionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
}

const STATE_TRANSLATION: Record<string, string> = {
  idle: 'Chờ (Idle)',
  paired: 'Đã nhận diện đủ xe & tài xế (Paired)',
  unlocking: 'Đang gửi lệnh mở khóa van (Unlocking)',
  ready: 'Cột bơm sẵn sàng bơm (Ready)',
  pumping: 'Đang bơm nhiên liệu (Pumping)',
  completed: 'Bơm hoàn tất (Completed)',
  timed_out: 'Hết thời gian chờ (Timed Out)',
  enable_failed: 'Lỗi mở khóa cột bơm (Enable Failed)',
  cancelled: 'Đã hủy bỏ (Cancelled)',
  aborted: 'Bị ngắt giữa chừng (Aborted)',
};

export function SessionDetailDialog({ open, onOpenChange, sessionId }: SessionDetailDialogProps) {
  const { data: session, isLoading } = useSession(sessionId || '', { enabled: open && Boolean(sessionId) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[92vh]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2.5">
              <DialogTitle className="font-mono text-xl">
                {session ? session.code : 'Chi tiết phiên đổ'}
              </DialogTitle>
              {session && (
                <Badge
                  variant={
                    session.status === 'completed'
                      ? 'secondary'
                      : session.status === 'failed'
                      ? 'destructive'
                      : 'outline'
                  }
                  className={
                    session.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : ''
                  }
                >
                  {session.status === 'completed'
                    ? 'Hoàn thành'
                    : session.status === 'failed'
                    ? 'Lỗi bơm'
                    : 'Đã hủy'}
                </Badge>
              )}
            </div>
            {session && (
              <span className="text-xs text-muted-foreground font-mono">
                Edge Ref: {session.edge_ref}
              </span>
            )}
          </div>
          <DialogDescription>
            {session ? (
              <span>
                {session.branch_name} • {session.pump_name} {session.tank_name ? `• ${session.tank_name}` : ''}
              </span>
            ) : (
              'Đang tải dữ liệu...'
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5 py-2">
          {isLoading || !session ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Đang tải chi tiết giao dịch bơm...
            </div>
          ) : (
            <>
              {/* Key Metrics Cards (Chỉ hiển thị Lít, tuyệt đối không có tiền) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-primary/5 border-primary/20 shadow-none">
                  <CardContent className="p-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Thực đổ thực tế
                    </span>
                    <div className="text-2xl font-bold text-primary tabular-nums mt-1">
                      {formatNumberVN(session.dispensed_liters, 2)} L
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      {session.dispensed_ml.toLocaleString()} ml
                    </span>
                  </CardContent>
                </Card>

                <Card className="shadow-none bg-card">
                  <CardContent className="p-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Hạn mức cấp phép
                    </span>
                    <div className="text-2xl font-bold text-foreground tabular-nums mt-1">
                      {session.limit_liters !== undefined && session.limit_liters !== null
                        ? `${formatNumberVN(session.limit_liters, 2)} L`
                        : '—'}
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      Giới hạn tối đa phiên này
                    </span>
                  </CardContent>
                </Card>

                <Card className="shadow-none bg-card">
                  <CardContent className="p-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Tổng đồng hồ tích lũy
                    </span>
                    <div className="text-2xl font-bold text-foreground tabular-nums mt-1">
                      {session.pump_total_liters !== undefined && session.pump_total_liters !== null
                        ? `${formatNumberVN(session.pump_total_liters, 2)} L`
                        : '—'}
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      Chỉ số đồng hồ cơ/điện tử cột bơm
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Thông tin đối tượng đổ & Thiết bị */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <TruckIcon className="h-4 w-4 text-primary" />
                    Phương tiện nhận nhiên liệu
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Biển số xe:</span>
                      <span className="font-semibold text-foreground text-sm font-mono">
                        {session.vehicle_plate || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Mã quản lý xe:</span>
                      <span className="font-medium text-foreground font-mono">
                        {session.vehicle_code || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <UserIcon className="h-4 w-4 text-primary" />
                    Tài xế / Người nhận
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Họ và tên:</span>
                      <span className="font-semibold text-foreground text-sm">
                        {session.driver_name || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Mã nhân sự:</span>
                      <span className="font-medium text-foreground font-mono">
                        {session.driver_code || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chi tiết thời gian & Bộ số sensor */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AdjustmentsHorizontalIcon className="h-4 w-4 text-primary" />
                  Thông số Kỹ thuật & Đối soát phần cứng
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Bắt đầu:</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatDateTimeVN(session.started_at, true)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Kết thúc:</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatDateTimeVN(session.finished_at, true)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Lần bơm (Sale Seq):</span>
                    <span className="font-mono font-medium text-foreground">
                      {session.sale_seq !== null && session.sale_seq !== undefined ? `#${session.sale_seq}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Serial bộ số:</span>
                    <span className="font-mono font-medium text-foreground">
                      {session.sensor_serial || '—'}
                    </span>
                  </div>
                </div>

                {session.raw_hex && (
                  <div className="pt-2 border-t text-xs">
                    <span className="text-muted-foreground block mb-1">Khung gói tin thô (Raw HEX):</span>
                    <pre className="p-2 rounded-md bg-muted font-mono text-[11px] overflow-x-auto text-foreground">
                      {session.raw_hex}
                    </pre>
                  </div>
                )}
              </div>

              {/* Dòng thời gian trạng thái (State Transition Timeline) */}
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-primary" />
                  Dòng thời gian phiên bơm ({session.timeline.length} mốc)
                </h4>

                {session.timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Không có dữ liệu chuyển trạng thái chi tiết.</p>
                ) : (
                  <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {session.timeline.map((event, idx) => (
                      <div key={idx} className="relative flex items-start gap-3">
                        <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shrink-0" />
                        <div className="flex-1 rounded-md border p-2.5 bg-card/60 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              {STATE_TRANSLATION[event.to_state] || event.to_state}
                            </span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {formatDateTimeVN(event.occurred_at, true)}
                            </span>
                          </div>
                          {event.from_state && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Chuyển từ: {STATE_TRANSLATION[event.from_state] || event.from_state}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nhật ký xác thực liên kết phiên này */}
              {session.access_events.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ShieldCheckIcon className="h-4 w-4 text-primary" />
                    Lượt xác thực định danh trong phiên
                  </h4>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left w-[140px]">Thời điểm</TableHead>
                          <TableHead className="text-left">Phương thức</TableHead>
                          <TableHead className="text-left">Mã nhận diện / UID</TableHead>
                          <TableHead className="text-left">Bên xác thực</TableHead>
                          <TableHead className="text-left w-[110px]">Kết quả</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {session.access_events.map((ae) => (
                          <TableRow key={ae.id}>
                            <TableCell className="tabular-nums text-xs text-muted-foreground text-left">
                              {formatDateTimeVN(ae.occurred_at, true)}
                            </TableCell>
                            <TableCell className="text-left">
                              <Badge variant="outline" className="text-[11px] capitalize">
                                {ae.method || ae.kind}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-left">
                              {ae.external_id || '—'}
                            </TableCell>
                            <TableCell className="text-xs text-left">
                              {ae.party_name || '—'}
                            </TableCell>
                            <TableCell className="text-left">
                              {ae.decision === 'accept' ? (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
                                  Hợp lệ
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[11px]">
                                  Từ chối ({ae.reason || 'Lỗi'})
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
