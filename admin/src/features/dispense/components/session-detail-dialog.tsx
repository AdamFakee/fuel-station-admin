'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClockIcon, ShieldCheckIcon, TruckIcon, UserIcon } from '@heroicons/react/24/outline';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { useSession } from '../api/get-session';

interface SessionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
}

/** Tên các bước của phiên bằng tiếng Việt, ngắn gọn: người đọc không cần biết tên trạng thái kỹ thuật. */
const STEP_LABEL: Record<string, string> = {
  idle: 'Chờ',
  paired: 'Đã nhận diện xe và tài xế',
  unlocking: 'Đang mở khóa cột bơm',
  ready: 'Cột bơm sẵn sàng, chờ bơm',
  pumping: 'Đang bơm nhiên liệu',
  dispensing: 'Bắt đầu bơm nhiên liệu',
  completed: 'Hoàn tất, đã bơm xong',
  timed_out: 'Hết thời gian chờ bơm',
  enable_failed: 'Mở khóa cột bơm thất bại',
  cancelled: 'Đã hủy',
  aborted: 'Bị ngắt giữa chừng',
};

/** Màu chấm trên dòng thời gian: xanh khi xong, đỏ khi lỗi, màu chủ đạo cho bước thường. */
const stepTone = (state: string) =>
  state === 'completed'
    ? 'bg-emerald-500 border-emerald-500'
    : ['timed_out', 'enable_failed', 'aborted', 'cancelled'].includes(state)
      ? 'bg-red-500 border-red-500'
      : 'bg-primary border-primary';

const METHOD_LABEL: Record<string, string> = { card: 'Thẻ', face: 'Khuôn mặt', fingerprint: 'Vân tay' };

const REASON_LABEL: Record<string, string> = {
  Unknown: 'không có trong danh mục',
  WrongKind: 'sai loại (tài xế/xe)',
  Blocked: 'đang bị cấm',
  Expired: 'đã hết hạn',
  NotYetValid: 'chưa tới hạn dùng',
  DirectoryError: 'lỗi danh mục',
  NotAllowedHere: 'không được đổ ở trạm này',
};

const timeOnly = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour12: false }) : '—';

/** `2 phút 5 giây`, `26 giây`, rỗng nếu không tính được. */
function duration(from?: string | null, to?: string | null): string {
  if (!from || !to) return '';
  const seconds = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`
    : `${minutes} phút${seconds % 60 ? ` ${seconds % 60} giây` : ''}`;
}

function Fact({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 break-words text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

export function SessionDetailDialog({ open, onOpenChange, sessionId }: SessionDetailDialogProps) {
  const { data: session, isLoading } = useSession(sessionId || '', { enabled: open && Boolean(sessionId) });
  const timeline = session?.timeline ?? [];
  const events = session?.access_events ?? [];

  const status =
    session?.status === 'completed'
      ? { label: 'Hoàn thành', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' }
      : session?.status === 'failed'
        ? { label: 'Lỗi bơm', className: 'bg-red-500/10 text-red-700 border-red-500/30' }
        : { label: 'Đã hủy', className: 'bg-muted text-muted-foreground border-border' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[92vh]">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-6">
            <DialogTitle className="font-mono text-xl">{session ? session.code : 'Chi tiết phiên đổ'}</DialogTitle>
            {session && (
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
            )}
          </div>
          <DialogDescription className={session ? 'sr-only' : ''}>
            {session ? `Chi tiết phiên đổ ${session.code}` : 'Đang tải dữ liệu...'}
          </DialogDescription>
          {session && (
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-3">
              <Fact label="Trạm xăng" value={session.branch_name} />
              <Fact label="Trụ bơm" value={session.pump_name} />
              <Fact label="Nhiên liệu" value={session.fuel_type_name} />
            </div>
          )}
        </DialogHeader>

        <DialogBody className="space-y-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading || !session ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Đang tải chi tiết phiên đổ...</div>
          ) : (
            <>
              {/* Kết quả chính: chỉ lít, không có tiền */}
              <section className="rounded-xl border bg-primary/5 p-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Đã đổ</p>
                    <p className="text-3xl font-bold tabular-nums text-primary">{formatNumberVN(session.dispensed_liters, 2)} L</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    {session.started_at && <Fact label="Bắt đầu" value={formatDateTimeVN(session.started_at, true)} />}
                    {session.finished_at && <Fact label="Kết thúc" value={formatDateTimeVN(session.finished_at, true)} />}
                  </div>
                </div>
                {duration(session.started_at, session.finished_at) && (
                  <p className="mt-3 text-xs text-muted-foreground">Thời gian bơm: {duration(session.started_at, session.finished_at)}</p>
                )}
              </section>

              {/* Ai, xe nào */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <TruckIcon className="h-4 w-4 text-primary" /> Xe
                  </p>
                  <p className="font-mono text-lg font-bold tracking-wide">{session.vehicle_plate || '—'}</p>
                  <p className="text-xs text-muted-foreground">Mã xe {session.vehicle_code || '—'}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <UserIcon className="h-4 w-4 text-primary" /> Tài xế
                  </p>
                  <p className="text-lg font-bold">{session.driver_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">Mã {session.driver_code || '—'}</p>
                </div>
              </section>

              {/* Diễn biến */}
              <section>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ClockIcon className="h-4 w-4 text-primary" /> Các bước của phiên đổ
                </h4>
                {timeline.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">Chưa có dữ liệu diễn biến chi tiết.</p>
                ) : (
                  <ol className="relative ml-2 space-y-3 border-l-2 border-border pl-6">
                    {timeline.map((event, index) => {
                      const previous = index > 0 ? timeline[index - 1] : null;
                      const gap = previous ? duration(previous.occurred_at, event.occurred_at) : '';
                      return (
                        <li key={index} className="relative">
                          <span className={`absolute -left-[33px] top-1 h-3 w-3 rounded-full border-2 ${stepTone(event.to_state)}`} />
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                            <p className="text-sm font-medium text-foreground">{STEP_LABEL[event.to_state] ?? event.to_state}</p>
                            <p className="text-sm tabular-nums text-muted-foreground">{timeOnly(event.occurred_at)}</p>
                          </div>
                          {gap && <p className="text-xs text-muted-foreground">{gap} sau bước trước</p>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {/* Xác thực */}
              {events.length > 0 && (
                <section>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheckIcon className="h-4 w-4 text-primary" /> Xác thực trong phiên
                  </h4>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px] text-left">Giờ</TableHead>
                          <TableHead className="text-left">Cách xác thực</TableHead>
                          <TableHead className="text-left">Mã thẻ / mã nhận diện</TableHead>
                          <TableHead className="text-left">Người, xe</TableHead>
                          <TableHead className="text-left">Kết quả</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((ae) => (
                          <TableRow key={ae.id}>
                            <TableCell className="text-left text-xs tabular-nums text-muted-foreground">{timeOnly(ae.occurred_at)}</TableCell>
                            <TableCell className="text-left text-sm">{METHOD_LABEL[ae.method ?? ''] ?? ae.method ?? ae.kind}</TableCell>
                            <TableCell className="text-left font-mono text-xs">{ae.external_id || '—'}</TableCell>
                            <TableCell className="text-left text-sm">{ae.party_name || '—'}</TableCell>
                            <TableCell className="text-left">
                              {ae.decision === 'accept' ? (
                                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700">
                                  Hợp lệ
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-xs text-red-700">
                                  Từ chối{ae.reason ? `: ${REASON_LABEL[ae.reason] ?? ae.reason}` : ''}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

            </>
          )}
        </DialogBody>

      </DialogContent>
    </Dialog>
  );
}
