'use client';

import * as React from 'react';
import { format, isValid, parse } from 'date-fns';
import { CalendarIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Bộ chọn ngày dùng chung cho toàn app (thay thế mọi ô `<input type="date">` và `datetime-local`).
 *
 * Giá trị là chuỗi, cùng định dạng với ô nhập gốc để đổi qua lại dễ:
 * - chỉ ngày: `yyyy-MM-dd`
 * - có giờ (`withTime`): `yyyy-MM-ddTHH:mm`
 * Chuỗi rỗng là chưa chọn.
 */
export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Chọn thêm giờ và phút. */
  withTime?: boolean;
  /** Cho phép xóa về rỗng (nút Xóa). */
  clearable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
}

const DATE_FORMAT = 'yyyy-MM-dd';
const DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm";

/** Đọc chuỗi giá trị thành Date; chuỗi rỗng hoặc sai định dạng thì trả `undefined`. */
function parseValue(value: string, withTime: boolean): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, withTime ? DATE_TIME_FORMAT : DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));

export function DatePicker({
  value,
  onChange,
  withTime = false,
  clearable = false,
  disabled,
  placeholder,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseValue(value, withTime);
  const outputFormat = withTime ? DATE_TIME_FORMAT : DATE_FORMAT;

  const hour = selected ? format(selected, 'HH') : '00';
  const minute = selected ? format(selected, 'mm') : '00';

  const handleSelectDay = (day: Date | undefined) => {
    if (!day) return;
    const next = new Date(day);
    if (withTime) {
      next.setHours(Number(hour), Number(minute), 0, 0);
    } else {
      next.setHours(0, 0, 0, 0);
      setOpen(false);
    }
    onChange(format(next, outputFormat));
  };

  const handleTimeChange = (nextHour: string, nextMinute: string) => {
    const base = selected ?? new Date();
    const next = new Date(base);
    next.setHours(Number(nextHour), Number(nextMinute), 0, 0);
    onChange(format(next, outputFormat));
  };

  const handleToday = () => {
    const now = new Date();
    if (!withTime) now.setHours(0, 0, 0, 0);
    onChange(format(now, outputFormat));
    if (!withTime) setOpen(false);
  };

  const label = selected
    ? format(selected, withTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy')
    : (placeholder ?? (withTime ? 'Chọn ngày giờ' : 'Chọn ngày'));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-2 px-3 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={handleSelectDay}
          captionLayout="dropdown"
          autoFocus
        />
        {withTime && (
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">Giờ</span>
            <Select value={hour} onValueChange={(next) => handleTimeChange(next, minute)}>
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">:</span>
            <Select value={minute} onValueChange={(next) => handleTimeChange(hour, next)}>
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center justify-between border-t px-2 py-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={handleToday}>
            {withTime ? 'Bây giờ' : 'Hôm nay'}
          </Button>
          {withTime && (
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Xong
            </Button>
          )}
          {clearable && selected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <XIcon className="mr-1 h-3.5 w-3.5" />
              Xóa
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
