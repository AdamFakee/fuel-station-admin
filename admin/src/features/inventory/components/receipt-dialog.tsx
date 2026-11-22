'use client';

import { useFullReceipt } from '../api/get-receipt';
import { OptionSelect } from '@/components/option-select';
import { DatePicker } from '@/components/date-picker';
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
import {
  PlusIcon,
  TrashIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from 'lucide-react';
import { StockReceipt, StockReceiptLineInput, CapacityCheckResult } from '../types';
import { useCreateReceipt } from '../api/create-receipt';
import { useUpdateReceipt } from '../api/update-receipt';
import { useBranches } from '@/features/assets/api/get-branches';
import { useTanks } from '@/features/assets/api/get-tanks';
import { useSuppliers } from '../api/get-suppliers';
import { checkCapacity } from '../api/check-capacity';
import { formatNumberVN } from '@/lib/format';
import { toast } from 'sonner';

interface FormLine {
  tank_id: string;
  fuel_type_id: string;
  fuel_type_name?: string;
  level_before_liters?: number;
  document_volume_liters: number;
  actual_volume_liters: number;
  level_after_liters?: number;
  capacityCheck?: CapacityCheckResult;
}

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt?: StockReceipt | null;
}

export function ReceiptDialog({ open, onOpenChange, receipt }: ReceiptDialogProps) {
  const isEditing = !!receipt;

  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data: supplierData } = useSuppliers();
  const suppliers = supplierData || [];

  // Danh sách phiếu không có các dòng bể: lấy bản đầy đủ để đổ vào form sửa
  const fullReceipt = useFullReceipt(receipt ?? null, open);

  const [branchId, setBranchId] = React.useState('');
  const [receivedAt, setReceivedAt] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [tankerPlate, setTankerPlate] = React.useState('');
  const [documentNo, setDocumentNo] = React.useState('');
  const [note, setNote] = React.useState('');
  const [lines, setLines] = React.useState<FormLine[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // Tanks filtered by the selected branch
  const { data: tankData } = useTanks({
    branch_id: branchId || undefined,
  });
  const tanks = tankData?.data || [];

  // Reset or fill form when receipt changes or dialog opens
  React.useEffect(() => {
    if (open) {
      if (receipt) {
        setBranchId(receipt.branch_id);
        setReceivedAt(
          receipt.received_at
            ? new Date(receipt.received_at).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16)
        );
        setSupplierId(receipt.supplier_id || '');
        setTankerPlate(receipt.tanker_plate || '');
        setDocumentNo(receipt.document_no || '');
        setNote(receipt.note || '');
        setLines(
          (fullReceipt?.lines ?? []).map((l) => ({
            tank_id: l.tank_id,
            fuel_type_id: l.fuel_type_id,
            fuel_type_name: l.fuel_type_name,
            level_before_liters: l.level_before_ml ? l.level_before_ml / 1000 : undefined,
            document_volume_liters: l.document_volume_ml / 1000,
            actual_volume_liters: l.actual_volume_ml / 1000,
            level_after_liters: l.level_after_ml ? l.level_after_ml / 1000 : undefined,
          }))
        );
      } else {
        const defaultBranchId = branches.length > 0 ? branches[0].id : '';
        setBranchId(defaultBranchId);
        setReceivedAt(new Date().toISOString().slice(0, 16));
        setSupplierId(suppliers.length > 0 ? suppliers[0].id : '');
        setTankerPlate('');
        setDocumentNo('');
        setNote('');
        setLines([]);
      }
    }
  }, [open, receipt, fullReceipt, branches, suppliers]);

  const createMutation = useCreateReceipt();
  const updateMutation = useUpdateReceipt();

  const handleAddLine = () => {
    if (tanks.length === 0) {
      toast.error('Vui lòng chọn trạm xăng có bể chứa trước khi thêm dòng nhập');
      return;
    }
    const defaultTank = tanks[0];
    setLines((prev) => [
      ...prev,
      {
        tank_id: defaultTank.id,
        fuel_type_id: defaultTank.fuel_type_id,
        fuel_type_name: defaultTank.fuel_type_name,
        document_volume_liters: 0,
        actual_volume_liters: 0,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTankChange = (index: number, newTankId: string) => {
    const selectedTank = tanks.find((t) => t.id === newTankId);
    if (!selectedTank) return;

    setLines((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        tank_id: newTankId,
        fuel_type_id: selectedTank.fuel_type_id,
        fuel_type_name: selectedTank.fuel_type_name,
        capacityCheck: undefined,
      };
      return next;
    });

    // Check capacity for new tank if actual volume > 0
    if (lines[index]?.actual_volume_liters > 0) {
      triggerCapacityCheck(index, newTankId, lines[index].actual_volume_liters);
    }
  };

  const triggerCapacityCheck = async (index: number, tankId: string, actualLiters: number) => {
    if (!tankId || actualLiters <= 0) return;
    try {
      const result = await checkCapacity({
        tank_id: tankId,
        incoming_volume_ml: Math.round(actualLiters * 1000),
      });
      setLines((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = { ...next[index], capacityCheck: result };
        }
        return next;
      });
    } catch {
      // Ignored non-blocking check failure
    }
  };

  const handleLineValueChange = (
    index: number,
    field: keyof FormLine,
    value: any
  ) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

    if (field === 'actual_volume_liters') {
      const tankId = lines[index]?.tank_id;
      if (tankId && value > 0) {
        triggerCapacityCheck(index, tankId, Number(value));
      }
    }
  };

  const totalActualLiters = lines.reduce(
    (sum, l) => sum + (Number(l.actual_volume_liters) || 0),
    0
  );
  const totalDocumentLiters = lines.reduce(
    (sum, l) => sum + (Number(l.document_volume_liters) || 0),
    0
  );
  const totalVarianceLiters = totalActualLiters - totalDocumentLiters;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('Vui lòng chọn trạm nhập');
      return;
    }
    if (lines.length === 0) {
      toast.error('Vui lòng thêm ít nhất một dòng bể nhập');
      return;
    }

    // Validate lines
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.tank_id || !l.fuel_type_id) {
        toast.error(`Dòng ${i + 1}: Vui lòng chọn bể chứa hợp lệ`);
        return;
      }
      if (l.actual_volume_liters <= 0) {
        toast.error(`Dòng ${i + 1}: Thể tích thực nhập phải lớn hơn 0 Lít`);
        return;
      }
      if (l.capacityCheck?.exceeds_capacity) {
        toast.error(
          `Dòng ${i + 1}: Lượng nhập (${formatNumberVN(l.actual_volume_liters)} Lít) vượt quá dung tích khả dụng còn lại của bể!`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payloadLines: StockReceiptLineInput[] = lines.map((l) => ({
        tank_id: l.tank_id,
        fuel_type_id: l.fuel_type_id,
        level_before_ml: l.level_before_liters
          ? Math.round(l.level_before_liters * 1000)
          : undefined,
        document_volume_ml: Math.round(l.document_volume_liters * 1000),
        actual_volume_ml: Math.round(l.actual_volume_liters * 1000),
        level_after_ml: l.level_after_liters
          ? Math.round(l.level_after_liters * 1000)
          : undefined,
      }));

      if (isEditing && receipt) {
        await updateMutation.mutateAsync({
          id: receipt.id,
          data: {
            branch_id: branchId,
            received_at: new Date(receivedAt).toISOString(),
            supplier_id: supplierId || undefined,
            tanker_plate: tankerPlate.trim() || undefined,
            document_no: documentNo.trim() || undefined,
            note: note.trim() || undefined,
            lines: payloadLines,
          },
        });
        toast.success(`Đã cập nhật phiếu nhập ${receipt.code}`);
      } else {
        const created = await createMutation.mutateAsync({
          branch_id: branchId,
          received_at: new Date(receivedAt).toISOString(),
          supplier_id: supplierId || undefined,
          tanker_plate: tankerPlate.trim() || undefined,
          document_no: documentNo.trim() || undefined,
          note: note.trim() || undefined,
          lines: payloadLines,
        });
        toast.success(`Đã tạo phiếu nhập ${created.code}`);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu phiếu nhập');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Chỉnh sửa phiếu nhập ${receipt?.code}` : 'Lập phiếu nhập bể'}
          </DialogTitle>
          <DialogDescription>
            Ghi nhận lượng nhiên liệu nhập vào bể chứa, tính bằng lít.
          </DialogDescription>
        </DialogHeader>

        <form id="receipt-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogBody className="space-y-6">
            {/* General Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="branch_id">Trạm xăng *</Label>
                <OptionSelect
                  id="branch_id"
                  className="mt-1.5"
                  value={branchId}
                  onChange={setBranchId}
                  disabled={isEditing}
                  required
                  emptyLabel="Chọn trạm"
                  options={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
                />
              </div>

              <div>
                <Label htmlFor="received_at">Thời gian nhập *</Label>
                <DatePicker
                  id="received_at"
                  withTime
                  className="mt-1.5"
                  value={receivedAt}
                  onChange={setReceivedAt}
                />
              </div>

              <div>
                <Label htmlFor="supplier_id">Nhà cung cấp</Label>
                <OptionSelect
                  id="supplier_id"
                  className="mt-1.5"
                  value={supplierId}
                  onChange={setSupplierId}
                  emptyLabel="Không chọn"
                  options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                />
              </div>

              <div>
                <Label htmlFor="tanker_plate">Biển số xe bồn chở hàng</Label>
                <Input
                  id="tanker_plate"
                  placeholder="VD: 29C-123.45"
                  className="mt-1.5"
                  value={tankerPlate}
                  onChange={(e) => setTankerPlate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="document_no">Số hóa đơn của nhà cung cấp</Label>
                <Input
                  id="document_no"
                  placeholder="VD: HĐ-00129"
                  className="mt-1.5"
                  value={documentNo}
                  onChange={(e) => setDocumentNo(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="note">Ghi chú</Label>
                <Input
                  id="note"
                  placeholder="Ghi chú về lần giao hàng này..."
                  className="mt-1.5"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            {/* Lines section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Bể nhận nhiên liệu *</h4>
                  <p className="text-xs text-muted-foreground">
                    Mỗi dòng là một bể. Nhập số lít ghi trên hóa đơn và số lít thực tế nhận được.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="flex items-center gap-1.5"
                >
                  <PlusIcon className="w-4 h-4" />
                  Thêm dòng bể
                </Button>
              </div>

              {lines.length === 0 ? (
                <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
                  Chưa có dòng bể nào. Nhấn &quot;Thêm dòng bể&quot; để khai báo bể tiếp nhận.
                </div>
              ) : (
                <div className="space-y-4">
                  {lines.map((line, idx) => {
                    const variance =
                      (Number(line.actual_volume_liters) || 0) -
                      (Number(line.document_volume_liters) || 0);

                    return (
                      <div
                        key={idx}
                        className="border rounded-lg p-4 bg-muted/20 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-semibold uppercase text-muted-foreground">
                            Dòng #{idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-destructive h-7 px-2 hover:bg-destructive/10"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">Bể chứa *</Label>
                            <OptionSelect
                              data-testid="line-tank-select"
                              className="mt-1 h-8 text-xs"
                              value={line.tank_id}
                              onChange={(next) => handleTankChange(idx, next)}
                              required
                              options={tanks.map((t) => ({ value: t.id, label: `${t.name} (${t.code}) - ${t.fuel_type_name}` }))}
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Loại nhiên liệu</Label>
                            <Input
                              disabled
                              value={line.fuel_type_name || '—'}
                              className="h-8 text-xs bg-muted mt-1"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Số lít theo hóa đơn *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={line.document_volume_liters || ''}
                              onChange={(e) =>
                                handleLineValueChange(
                                  idx,
                                  'document_volume_liters',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-8 text-xs mt-1 text-right tabular-nums"
                              required
                            />
                          </div>

                          <div>
                            <Label className="text-xs font-semibold">Số lít thực nhận *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={line.actual_volume_liters || ''}
                              onChange={(e) =>
                                handleLineValueChange(
                                  idx,
                                  'actual_volume_liters',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-8 text-xs mt-1 text-right tabular-nums font-semibold"
                              required
                            />
                          </div>
                        </div>

                        {/* Variance and Capacity Feedback */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                          <div className="flex items-center gap-2">
                            <span>Chênh lệch (thực nhận trừ hóa đơn):</span>
                            <span
                              className={`font-semibold tabular-nums ${
                                variance < 0
                                  ? 'text-destructive'
                                  : variance > 0
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {variance > 0 ? `+${formatNumberVN(variance)}` : formatNumberVN(variance)} Lít
                            </span>
                          </div>

                          {line.capacityCheck && (
                            <div className="flex items-center gap-1.5">
                              {line.capacityCheck.exceeds_capacity ? (
                                <span className="flex items-center gap-1 text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded">
                                  <AlertTriangleIcon className="w-3.5 h-3.5" />
                                  Vượt sức chứa khả dụng! (Còn trống: {formatNumberVN(line.capacityCheck.available_room_ml / 1000)} L)
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                                  <CheckCircle2Icon className="w-3.5 h-3.5" />
                                  Đủ sức chứa (Còn trống: {formatNumberVN(line.capacityCheck.available_room_ml / 1000)} L)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Total Summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">Tổng cộng:</span>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-muted-foreground mr-1">Theo hóa đơn:</span>
                  <span className="font-semibold tabular-nums">{formatNumberVN(totalDocumentLiters)} L</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mr-1">Thực nhận:</span>
                  <span className="font-bold text-primary tabular-nums text-base">{formatNumberVN(totalActualLiters)} L</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mr-1">Chênh lệch:</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      totalVarianceLiters < 0
                        ? 'text-destructive'
                        : totalVarianceLiters > 0
                        ? 'text-emerald-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {totalVarianceLiters > 0 ? `+${formatNumberVN(totalVarianceLiters)}` : formatNumberVN(totalVarianceLiters)} L
                  </span>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="border-t p-4 bg-muted/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo phiếu nhập'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
