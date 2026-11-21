'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Radix Select không cho giá trị rỗng, nên dùng giá trị đặc biệt này cho lựa chọn "không chọn / tất cả". */
const EMPTY_VALUE = '__empty__';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
}

interface OptionSelectProps {
  /** Giá trị đang chọn; chuỗi rỗng là chưa chọn (hoặc "tất cả"). */
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /**
   * Nhãn của lựa chọn rỗng ("Tất cả trạm xăng", "Không chọn"...). Có thì danh sách có thêm dòng này ở đầu và chọn lại được về rỗng.
   * Không có thì ô bắt buộc chọn một giá trị trong `options`.
   */
  emptyLabel?: string;
  /** Chữ mờ khi chưa chọn gì và không có `emptyLabel`. */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  'data-testid'?: string;
}

/** Ô chọn dùng chung toàn app (thay `<select>` mặc định của trình duyệt): cùng kiểu với Select của shadcn, API đơn giản theo danh sách. */
export function OptionSelect({
  value,
  onChange,
  options,
  emptyLabel,
  placeholder,
  disabled,
  required,
  id,
  className,
  'data-testid': testId,
}: OptionSelectProps) {
  return (
    <Select
      value={value === '' ? (emptyLabel ? EMPTY_VALUE : '') : value}
      onValueChange={(next) => onChange(next === EMPTY_VALUE ? '' : next)}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger id={id} data-testid={testId} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder ?? emptyLabel ?? 'Chọn'} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel && <SelectItem value={EMPTY_VALUE}>{emptyLabel}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
