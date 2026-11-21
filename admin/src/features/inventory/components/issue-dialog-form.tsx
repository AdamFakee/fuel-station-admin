'use client';

import { OptionSelect } from '@/components/option-select';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StockIssue, IssueKind } from '../types';
import { useCreateIssue } from '../api/create-issue';
import { useUpdateIssue } from '../api/update-issue';
import { useBranches } from '@/features/assets/api/get-branches';
import { useTanks } from '@/features/assets/api/get-tanks';
import { formatNumberVN } from '@/lib/format';
import { toast } from 'sonner';

interface IssueDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: StockIssue | null;
}

export function IssueDialogForm({ open, onOpenChange, issue }: IssueDialogFormProps) {
  const isEditing = !!issue;

  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const [branchId, setBranchId] = React.useState('');
  const [kind, setKind] = React.useState<IssueKind>('transfer');
  const [tankId, setTankId] = React.useState('');
  const [toTankId, setToTankId] = React.useState('');
  const [volumeLiters, setVolumeLiters] = React.useState<string>('');
  const [reason, setReason] = React.useState('');

  const createMutation = useCreateIssue();
  const updateMutation = useUpdateIssue();

  // Load all tanks for branch
  const { data: tankData } = useTanks({
    branch_id: branchId || undefined,
  });
  const tanks = (tankData?.data || []).filter((t) => t.status === 'active');

  // Selected source tank
  const selectedSourceTank = tanks.find((t) => t.id === tankId);

  // Filter destination tanks: same fuel type, different tank
  const availableToTanks = tanks.filter(
    (t) =>
      t.id !== tankId &&
      (!selectedSourceTank || t.fuel_type_id === selectedSourceTank.fuel_type_id)
  );

  React.useEffect(() => {
    if (open) {
      if (issue) {
        setBranchId(issue.branch_id);
        setKind(issue.kind);
        setTankId(issue.tank_id);
        setToTankId(issue.to_tank_id || '');
        setVolumeLiters(issue.volume_liters.toString());
        setReason(issue.reason);
      } else {
        setBranchId(branches[0]?.id || '');
        setKind('transfer');
        setTankId('');
        setToTankId('');
        setVolumeLiters('');
        setReason('');
      }
    }
  }, [open, issue, branches]);

  // If source tank changes and destination tank doesn't match fuel type, reset destination tank
  React.useEffect(() => {
    if (selectedSourceTank && toTankId) {
      const dest = tanks.find((t) => t.id === toTankId);
      if (dest && dest.fuel_type_id !== selectedSourceTank.fuel_type_id) {
        setToTankId('');
      }
    }
  }, [selectedSourceTank, toTankId, tanks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      toast.error('Vui lòng chọn trạm xăng');
      return;
    }
    if (!tankId) {
      toast.error('Vui lòng chọn bể xuất');
      return;
    }
    if (kind === 'transfer' && !toTankId) {
      toast.error('Vui lòng chọn bể nhận điều chuyển');
      return;
    }
    if (kind === 'transfer' && toTankId === tankId) {
      toast.error('Bể nhận phải khác bể xuất');
      return;
    }

    const volNum = parseFloat(volumeLiters);
    if (isNaN(volNum) || volNum <= 0) {
      toast.error('Số lượng xuất phải lớn hơn 0 Lít');
      return;
    }

    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do xuất');
      return;
    }

    try {
      if (isEditing && issue) {
        await updateMutation.mutateAsync({
          id: issue.id,
          data: {
            branch_id: branchId,
            kind,
            tank_id: tankId,
            to_tank_id: kind === 'transfer' ? toTankId : undefined,
            volume_liters: volNum,
            reason: reason.trim(),
          },
        });
      } else {
        await createMutation.mutateAsync({
          branch_id: branchId,
          kind,
          tank_id: tankId,
          to_tank_id: kind === 'transfer' ? toTankId : undefined,
          volume_liters: volNum,
          reason: reason.trim(),
        });
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Chỉnh sửa phiếu xuất điều chỉnh' : 'Lập phiếu xuất điều chỉnh'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Cập nhật thông tin phiếu xuất ${issue?.code} (chỉ cho phép khi ở trạng thái Bản nháp)`
              : 'Tạo phiếu xuất điều chuyển nội bộ, hao hụt bốc hơi hoặc kiểm định cột bơm'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="issue-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="issue-branch">Trạm xăng *</Label>
                <OptionSelect
                  id="issue-branch"
                  value={branchId}
                  onChange={(next) => {
                    setBranchId(next);
                    setTankId('');
                    setToTankId('');
                  }}
                  emptyLabel="Chọn trạm xăng"
                  required
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issue-kind">Loại phiếu xuất *</Label>
                <OptionSelect
                  id="issue-kind"
                  value={kind}
                  onChange={(next) => {
                    const newKind = next as IssueKind;
                    setKind(newKind);
                    if (newKind !== 'transfer') {
                      setToTankId('');
                    }
                  }}
                  options={[
                    { value: 'transfer', label: 'Điều chuyển nội bộ (Transfer)' },
                    { value: 'loss', label: 'Hao hụt tự nhiên (Loss)' },
                    { value: 'inspection', label: 'Kiểm định cột bơm (Inspection)' },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="issue-tank">Bể nguồn (xuất) *</Label>
                <OptionSelect
                  id="issue-tank"
                  value={tankId}
                  onChange={(next) => {
                    setTankId(next);
                    if (toTankId === next) {
                      setToTankId('');
                    }
                  }}
                  emptyLabel="Chọn bể xuất"
                  required
                  options={tanks.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.fuel_type_name}) - Tồn: ${formatNumberVN(Math.round(t.current_stock_ml / 1000))} L`,
                  }))}
                />
                {selectedSourceTank && (
                  <p className="text-xs text-muted-foreground">
                    Loại xăng dầu: <span className="font-medium text-foreground">{selectedSourceTank.fuel_type_name}</span> | 
                    Tồn khả dụng: <span className="font-semibold text-primary">{formatNumberVN(Math.round(selectedSourceTank.current_stock_ml / 1000))} L</span>
                  </p>
                )}
              </div>

              {kind === 'transfer' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="issue-to-tank">Bể đích (nhận) *</Label>
                  <OptionSelect
                    id="issue-to-tank"
                    value={toTankId}
                    onChange={setToTankId}
                    emptyLabel="Chọn bể nhận (cùng loại hàng)"
                    required
                    disabled={!tankId}
                    options={availableToTanks.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.fuel_type_name}) - Tồn: ${formatNumberVN(Math.round(t.current_stock_ml / 1000))} L`,
                    }))}
                  />
                  {!tankId && (
                    <p className="text-xs text-muted-foreground">Vui lòng chọn bể xuất trước</p>
                  )}
                  {tankId && availableToTanks.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Không có bể nào khác cùng loại {selectedSourceTank?.fuel_type_name} trong trạm
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 flex flex-col justify-center">
                  <p className="text-xs text-muted-foreground italic">
                    {kind === 'loss'
                      ? 'Xuất hao hụt tự nhiên do bốc hơi hoặc hao hụt vật lý. Lượng xuất sẽ ghi giảm trực tiếp tồn kho của bể nguồn.'
                      : 'Xuất kiểm định dung tích cột bơm / đo mẫu. Lượng xuất ghi giảm trực tiếp tồn kho của bể nguồn.'}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-volume">Lượng xuất (Lít) *</Label>
              <Input
                id="issue-volume"
                type="number"
                min="0.01"
                step="any"
                placeholder="Ví dụ: 500"
                value={volumeLiters}
                onChange={(e) => setVolumeLiters(e.target.value)}
                required
              />
              {selectedSourceTank && volumeLiters && !isNaN(parseFloat(volumeLiters)) && (
                <div className="text-xs text-muted-foreground flex gap-4 pt-1">
                  <span>
                    Dự kiến sau xuất:{' '}
                    <strong
                      className={
                        Math.round(selectedSourceTank.current_stock_ml / 1000) - parseFloat(volumeLiters) < 0
                          ? 'text-destructive'
                          : 'text-foreground'
                      }
                    >
                      {formatNumberVN(
                        Math.round(selectedSourceTank.current_stock_ml / 1000) - parseFloat(volumeLiters)
                      )}{' '}
                      L
                    </strong>
                  </span>
                  {Math.round(selectedSourceTank.current_stock_ml / 1000) - parseFloat(volumeLiters) < 0 && (
                    <span className="text-destructive font-medium">⚠️ Cảnh báo: Vượt quá tồn kho thực tế!</span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-reason">Lý do xuất *</Label>
              <Textarea
                id="issue-reason"
                rows={3}
                placeholder="Nhập lý do xuất điều chuyển, biên bản hao hụt hoặc biên bản kiểm định..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button type="submit" form="issue-form" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo phiếu xuất'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
