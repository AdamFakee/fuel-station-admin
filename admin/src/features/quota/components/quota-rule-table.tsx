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
import { Button } from '@/components/ui/button';
import { QuotaRule } from '../types';
import { PencilSquareIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCancelQuotaRule } from '../api/cancel-quota-rule';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/use-auth';

interface QuotaRuleTableProps {
  rules: QuotaRule[];
  onEdit: (rule: QuotaRule) => void;
  isLoading?: boolean;
}

const periodLabels: Record<string, { label: string; className: string }> = {
  per_dispense: { label: 'Từng lần', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  day: { label: 'Theo ngày', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  week: { label: 'Theo tuần', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  month: { label: 'Theo tháng', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const targetTypeLabels: Record<string, { label: string; className: string }> = {
  vehicle: { label: 'Xe', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  vehicle_group: { label: 'Nhóm xe', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  route: { label: 'Tuyến đường', className: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export function QuotaRuleTable({ rules, onEdit, isLoading }: QuotaRuleTableProps) {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('master.quota:update');
  const canDelete = hasPermission('master.quota:delete');

  const [cancelTarget, setCancelTarget] = React.useState<QuotaRule | null>(null);
  const cancelMutation = useCancelQuotaRule();

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget.id);
      toast.success(`Đã hủy quy tắc định mức ${cancelTarget.code}`);
      setCancelTarget(null);
    } catch {
      toast.error('Không thể hủy quy tắc định mức. Vui lòng thử lại.');
    }
  };

  const formatLiters = (liters: number) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).format(liters);
  };

  const formatDateVN = (dateStr?: string) => {
    if (!dateStr) return 'Vô thời hạn';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Đang tải danh sách quy tắc định mức...
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Chưa có quy tắc định mức nào được thiết lập.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] text-left">Mã định mức</TableHead>
              <TableHead className="text-left">Đối tượng áp dụng</TableHead>
              <TableHead className="w-[120px] text-left">Chu kỳ</TableHead>
              <TableHead className="w-[130px] text-right">Định mức (Lít)</TableHead>
              <TableHead className="w-[130px] text-right">Giãn cách (Phút)</TableHead>
              <TableHead className="w-[190px] text-left">Thời gian hiệu lực</TableHead>
              <TableHead className="w-[110px] text-center">Trạng thái</TableHead>
              <TableHead className="w-[110px] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => {
              const periodInfo = periodLabels[rule.period] || { label: rule.period, className: '' };
              const targetInfo = targetTypeLabels[rule.target_type] || { label: rule.target_type, className: '' };
              const isActive = rule.status === 'active';

              return (
                <TableRow key={rule.id}>
                  {/* Mã định mức */}
                  <TableCell className="font-mono text-xs font-semibold text-foreground text-left">
                    {rule.code}
                  </TableCell>

                  {/* Đối tượng */}
                  <TableCell className="text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${targetInfo.className}`}>
                        {targetInfo.label}
                      </Badge>
                      <span className="font-medium text-sm text-foreground">
                        {rule.target_name || rule.target_code || 'Chưa cập nhật'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Chu kỳ */}
                  <TableCell className="text-left">
                    <Badge variant="outline" className={`text-xs border ${periodInfo.className}`}>
                      {periodInfo.label}
                    </Badge>
                  </TableCell>

                  {/* Định mức lít (Căn phải theo chuẩn admin-table-format) */}
                  <TableCell className="text-right font-mono font-bold text-foreground">
                    {formatLiters(rule.max_volume_liters)} L
                  </TableCell>

                  {/* Giãn cách phút (Căn phải) */}
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {rule.min_interval_minutes > 0 ? `${rule.min_interval_minutes} phút` : 'Không'}
                  </TableCell>

                  {/* Thời gian hiệu lực */}
                  <TableCell className="text-left text-xs text-muted-foreground font-mono">
                    {formatDateVN(rule.effective_from)}
                    <span className="mx-1">→</span>
                    {formatDateVN(rule.effective_to)}
                  </TableCell>

                  {/* Trạng thái */}
                  <TableCell className="text-center">
                    <Badge
                      variant={isActive ? 'default' : 'secondary'}
                      className={isActive ? 'bg-success/15 text-success hover:bg-success/20 border-transparent text-xs' : 'text-xs text-muted-foreground'}
                    >
                      {isActive ? 'Hiệu lực' : 'Đã hủy'}
                    </Badge>
                  </TableCell>

                  {/* Thao tác */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(rule)}
                          title="Chỉnh sửa định mức"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                          <span className="sr-only">Sửa</span>
                        </Button>
                      )}
                      {canDelete && isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setCancelTarget(rule)}
                          title="Hủy hiệu lực định mức"
                        >
                          <NoSymbolIcon className="h-4 w-4" />
                          <span className="sr-only">Hủy</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Dialog Hủy Định mức (theo confirm-dialog skill) */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        level="destructive"
        title={`Hủy hiệu lực định mức ${cancelTarget?.code}`}
        description={`Bạn có chắc chắn muốn hủy quy tắc định mức này cho ${cancelTarget?.target_name}?`}
        consequences={[
          'Các lần cấp phát nhiên liệu tiếp theo sẽ không còn áp dụng hạn mức này.',
          'Thao tác hủy không thể phục hồi (bản ghi sẽ được đánh dấu Đã hủy trong lịch sử kiểm toán).',
        ]}
        confirmText="Hủy hiệu lực"
        cancelText="Đóng"
        loading={cancelMutation.isPending}
        onConfirm={handleConfirmCancel}
      />
    </>
  );
}
