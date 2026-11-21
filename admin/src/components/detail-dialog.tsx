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
}

/** Hộp thoại xem chi tiết chỉ đọc dùng chung: bấm vào một dòng của bảng là mở ra. */
export function DetailDialog({ open, onOpenChange, title, description, sections }: DetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="space-y-6 py-2">
          {sections.map((section, index) => (
            <div key={section.title ?? index} className="space-y-3">
              {section.title && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
              )}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border bg-card p-5 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.label} className={field.wide ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
                    <dt className="text-xs text-muted-foreground">{field.label}</dt>
                    <dd className="break-words text-sm font-medium text-foreground">{field.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
