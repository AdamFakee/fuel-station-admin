import { clsx, type ClassValue } from 'clsx';
import moment from 'moment-timezone';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

import { copyToClipboard as safeCopyToClipboard } from './clipboard';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number, showSuffix = true): string {
  const formatted = (amount || 0).toLocaleString('vi-VN');
  return showSuffix ? `${formatted} ₫` : formatted;
}

export function randomCode(prefix: string, length = 6): string {
  const digits = Array.from({ length }, () =>
    Math.floor(Math.random() * 10)
  ).join('');
  return `${prefix}${digits}`;
}

export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    const ok = await safeCopyToClipboard(text);
    if (ok) {
      toast.success('Sao chép thành công!');
    } else {
      toast.error('Sao chép thất bại!');
    }
  } catch (err) {
    toast.error('Sao chép thất bại!');
    console.error('Lỗi khi copy:', err);
  }
};

export const TABS = [
  'Hôm nay',
  'Tuần này',
  'Tháng này',
  'Quý I',
  'Quý II',
  'Quý III',
  'Quý IV',
  'Năm này',
] as const;

export type Tab = (typeof TABS)[number];

export type Range = {
  from: Date | undefined;
  to: Date | undefined;
};

export function calcRange(tab: Tab | '', year: number): Range {
  const timezone = 'Asia/Ho_Chi_Minh';

  switch (tab) {
    case 'Hôm nay':
      return {
        from: moment.tz(timezone).startOf('day').toDate(),
        to: moment.tz(timezone).endOf('day').toDate(),
      };

    case 'Tuần này':
      return {
        from: moment.tz(timezone).startOf('week').toDate(),
        to: moment.tz(timezone).endOf('week').toDate(),
      };

    case 'Tháng này':
      return {
        from: moment.tz(timezone).startOf('month').toDate(),
        to: moment.tz(timezone).endOf('month').toDate(),
      };

    case 'Quý I': {
      const start = moment
        .tz({ year, month: 0, day: 1 }, timezone)
        .startOf('day');
      const end = moment.tz({ year, month: 2, day: 31 }, timezone).endOf('day');
      return { from: start.toDate(), to: end.toDate() };
    }
    case 'Quý II': {
      const start = moment
        .tz({ year, month: 3, day: 1 }, timezone)
        .startOf('day');
      const end = moment.tz({ year, month: 5, day: 30 }, timezone).endOf('day');
      return { from: start.toDate(), to: end.toDate() };
    }
    case 'Quý III': {
      const start = moment
        .tz({ year, month: 6, day: 1 }, timezone)
        .startOf('day');
      const end = moment.tz({ year, month: 8, day: 30 }, timezone).endOf('day');
      return { from: start.toDate(), to: end.toDate() };
    }
    case 'Quý IV': {
      const start = moment
        .tz({ year, month: 9, day: 1 }, timezone)
        .startOf('day');
      const end = moment
        .tz({ year, month: 11, day: 31 }, timezone)
        .endOf('day');
      return { from: start.toDate(), to: end.toDate() };
    }

    case 'Năm này':
      return {
        from: moment.tz(timezone).year(year).startOf('year').toDate(),
        to: moment.tz(timezone).year(year).endOf('year').toDate(),
      };

    default:
      return {
        from: moment.tz(timezone).startOf('day').toDate(),
        to: moment.tz(timezone).endOf('day').toDate(),
      };
  }
}

export function formatInventoryStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'in_stock':
      return 'Còn hàng';
    case 'low_stock':
      return 'Tồn thấp';
    case 'out_of_stock':
      return 'Hết hàng';
    case 'draft':
      return 'Nháp';
    case 'pending':
      return 'Chờ xử lý';
    case 'completed':
    case 'done':
      return 'Hoàn tất';
    case 'cancelled':
      return 'Đã hủy';
    default:
      return status || '-';
  }
}
