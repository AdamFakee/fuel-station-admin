'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 15, 20, 50, 100];

interface PaginatorProps {
  /** Trang hiện tại, bắt đầu từ 1. */
  currentPage: number;
  /** Số dòng mỗi trang. */
  pageSize: number;
  /** Tổng số bản ghi (toàn bộ, không chỉ trang hiện tại). */
  totalItems: number;
  /** Gọi khi đổi trang hoặc đổi số dòng mỗi trang (đổi số dòng thì về trang 1). */
  onPageChange: (page: number, pageSize: number) => void;
  className?: string;
}

/** Dãy số trang rút gọn: luôn có trang đầu và cuối, dùng `null` cho dấu "...". */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/**
 * Thanh phân trang chuẩn dưới mọi bảng: "Hiển thị 1–15 trên 42", chọn số dòng mỗi trang, nút trước/sau và số trang.
 * Luôn hiện khi có dữ liệu (kể cả chỉ một trang) để người dùng biết tổng số bản ghi.
 */
export default function Paginator({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  className,
}: PaginatorProps) {
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const go = (next: number) => {
    if (next < 1 || next > totalPages || next === page) return;
    onPageChange(next, pageSize);
  };

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-3 rounded-md border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="tabular-nums">
          Hiển thị <span className="font-medium text-foreground">{from}–{to}</span> trên{' '}
          <span className="font-medium text-foreground">{totalItems}</span> bản ghi
        </span>
        <div className="flex items-center gap-2">
          <span>Mỗi trang</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageChange(1, Number(value))}
          >
            <SelectTrigger size="sm" className="h-8 w-[78px] bg-card text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className="h-8 min-w-8 px-2 tabular-nums"
              onClick={() => go(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          aria-label="Trang sau"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
