'use client';

import * as React from 'react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface DetailField {
  label: string;
  value: React.ReactNode;
  /** Chiếm cả hàng (dùng cho ghi chú, địa chỉ dài). */
  wide?: boolean;
}

export interface DetailSection {
  title?: string;
  fields: DetailField[];
}

interface DetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  sections: DetailSection[];
  /** 'stacked': các nhóm xếp dọc trong một cột (mặc định xếp hai cột khi có nhiều nhóm). */
  layout?: 'columns' | 'stacked';
}

/** Hộp thoại xem chi tiết chỉ đọc dùng chung: bấm vào một dòng của bảng là mở ra. */
export function DetailDialog({ open, onOpenChange, title, description, sections, layout = 'columns' }: DetailDialogProps) {
  // Cột trái: nhóm đầu tiên rồi tới nhóm "Hệ thống" (ngày tạo, cập nhật) ngay bên dưới; cột phải: các nhóm còn lại.
  const system = sections.filter((section, index) => index > 0 && section.title === 'Hệ thống');
  const leftColumn = layout === 'stacked' ? sections : sections.length > 0 ? [sections[0], ...system] : [];
  const rightColumn = layout === 'stacked' ? [] : sections.filter((section, index) => index > 0 && !system.includes(section));
  // Chỉ có một cột thì hộp hẹp lại, không để nửa bên phải trống
  const twoColumns = rightColumn.length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={twoColumns ? '2xl' : 'lg'} className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {/* Mô tả loại bản ghi (vd "Trụ bơm") chỉ để trình đọc màn hình, không hiện ra: tiêu đề đã đủ rõ */}
          <DialogDescription className="sr-only">{description ?? title}</DialogDescription>
        </DialogHeader>
        {/* Các nhóm thông tin xếp hai cột để hộp vừa màn hình, không phải cuộn dài */}
        <DialogBody className="py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={twoColumns ? 'grid grid-cols-1 items-start gap-4 md:grid-cols-2' : ''}>
            {[leftColumn, rightColumn].map(
              (column, columnIndex) =>
                column.length > 0 && (
                  <div key={columnIndex} className="space-y-4">
                    {column.map((section, index) => (
                      <div key={section.title ?? index} className="space-y-2">
                        {section.title && (
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
                        )}
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-card p-4">
                          {section.fields.map((field) => (
                            <div key={field.label} className={field.wide ? 'col-span-2 space-y-0.5' : 'space-y-0.5'}>
                              <dt className="text-xs text-muted-foreground">{field.label}</dt>
                              <dd className="break-words text-sm font-medium text-foreground">{field.value || '—'}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                )
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
