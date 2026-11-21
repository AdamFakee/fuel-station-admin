'use client';

import { DatePicker } from '@/components/date-picker';
import React from 'react';
import { ReportFilterState, ReportTemplateType } from '../types';
import { useBranches } from '@/features/assets/api/get-branches';
import { useTanks } from '@/features/assets/api/get-tanks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, RotateCcw } from 'lucide-react';

interface ReportFiltersProps {
  template: ReportTemplateType;
  filters: ReportFilterState;
  onChange: (filters: ReportFilterState) => void;
  onReset: () => void;
}

export function ReportFilters({ template, filters, onChange, onReset }: ReportFiltersProps) {
  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data: tankData } = useTanks({ branch_id: filters.branchId });
  const tanks = tankData?.data || [];

  const setPreset = (type: 'today' | 'week' | 'month') => {
    const now = new Date();
    const toDate = now.toISOString().slice(0, 10);
    let fromDate = toDate;

    if (type === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().slice(0, 10);
    } else if (type === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      fromDate = d.toISOString().slice(0, 10);
    }

    onChange({
      ...filters,
      fromDate,
      toDate,
    });
  };

  const showTankFilter = template === 'stock-ledger' || template === 'receipts' || template === 'dispenses' || template === 'reconciliation';
  const showStatusFilter = template === 'receipts' || template === 'dispenses' || template === 'reconciliation';

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span>Bộ lọc tham số báo cáo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Khoảng nhanh:</span>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset('today')}>
            Hôm nay
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset('week')}>
            7 ngày qua
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset('month')}>
            Tháng này
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Từ ngày */}
        <div className="space-y-1.5">
          <Label className="text-xs">Từ ngày</Label>
          <DatePicker
            className="h-8 text-xs"
            value={filters.fromDate || ''}
            onChange={(fromDate) => onChange({ ...filters, fromDate })}
          />
        </div>

        {/* Đến ngày */}
        <div className="space-y-1.5">
          <Label className="text-xs">Đến ngày</Label>
          <DatePicker
            className="h-8 text-xs"
            value={filters.toDate || ''}
            onChange={(toDate) => onChange({ ...filters, toDate })}
          />
        </div>

        {/* Trạm xăng */}
        <div className="space-y-1.5">
          <Label className="text-xs">Trạm xăng / Trạm</Label>
          <Select
            value={filters.branchId || 'ALL'}
            onValueChange={(val) => onChange({ ...filters, branchId: val === 'ALL' ? undefined : val, tankId: undefined })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tất cả trạm xăng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạm xăng</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bể chứa (nếu áp dụng) */}
        {showTankFilter && (
          <div className="space-y-1.5">
            <Label className="text-xs">Bể chứa</Label>
            <Select
              value={filters.tankId || 'ALL'}
              onValueChange={(val) => onChange({ ...filters, tankId: val === 'ALL' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tất cả các bể" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả các bể</SelectItem>
                {tanks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Trạng thái (nếu áp dụng) */}
        {showStatusFilter && (
          <div className="space-y-1.5">
            <Label className="text-xs">Trạng thái</Label>
            <Select
              value={filters.status || 'ALL'}
              onValueChange={(val) => onChange({ ...filters, status: val === 'ALL' ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tất cả trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                {template === 'receipts' && (
                  <>
                    <SelectItem value="approved">Đã duyệt</SelectItem>
                    <SelectItem value="pending">Chờ duyệt</SelectItem>
                    <SelectItem value="rejected">Từ chối</SelectItem>
                  </>
                )}
                {template === 'dispenses' && (
                  <>
                    <SelectItem value="completed">Hoàn thành</SelectItem>
                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                    <SelectItem value="failed">Lỗi</SelectItem>
                  </>
                )}
                {template === 'reconciliation' && (
                  <>
                    <SelectItem value="matched">Khớp chuẩn</SelectItem>
                    <SelectItem value="alert">Vượt ngưỡng hao hụt</SelectItem>
                    <SelectItem value="confirmed">Đã xác nhận</SelectItem>
                    <SelectItem value="open">Mở</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Đặt lại bộ lọc
        </Button>
      </div>
    </div>
  );
}
