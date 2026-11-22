import { ImportColumn, RawCell } from '@/components/excel-import/types';
import { CreateDriverInput } from '../types';

/** Đổi ngày dd/MM/yyyy (hoặc yyyy-MM-dd) thành ISO để gửi server; ném lỗi tiếng Việt nếu sai. */
function parseDate(raw: RawCell): string {
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const [year, month, day] = vn
    ? [Number(vn[3]), Number(vn[2]), Number(vn[1])]
    : iso
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : [0, 0, 0];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    year > 0 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate) throw new Error('Ngày không hợp lệ, nhập dạng dd/MM/yyyy (ví dụ 31/12/2026)');
  return date.toISOString();
}

/** Các cột của file Excel nhập tài xế. Thứ tự là thứ tự cột trong file mẫu. */
export const driverImportColumns: ImportColumn<CreateDriverInput>[] = [
  { key: 'full_name', header: 'Họ và tên', required: true, width: 28, example: 'Nguyễn Văn A', placeholder: 'VD: Nguyễn Văn A' },
  { key: 'phone', header: 'Số điện thoại', width: 16, example: '0912345678' },
  {
    key: 'card_number',
    header: 'Số thẻ NFC',
    width: 16,
    example: '2001234567',
    hint: 'Chuỗi số thập phân của thẻ. Có thể để trống rồi gán thẻ sau.',
    parse: (raw) => {
      if (!/^[0-9]{1,32}$/.test(raw)) throw new Error('Số thẻ phải là chuỗi chữ số thập phân');
      return raw;
    },
  },
  {
    key: 'valid_from',
    header: 'Hiệu lực từ',
    width: 16,
    example: '01/01/2026',
    hint: 'Dạng dd/MM/yyyy. Để trống nếu không giới hạn.',
    parse: parseDate,
  },
  {
    key: 'valid_to',
    header: 'Hiệu lực đến',
    width: 16,
    example: '31/12/2026',
    hint: 'Dạng dd/MM/yyyy. Để trống nếu vô thời hạn.',
    parse: parseDate,
  },
  { key: 'note', header: 'Ghi chú', width: 30 },
];

/** Gọi một dòng là ai: tên tài xế (mã nhân viên do hệ thống tự sinh nên không có trong file). */
export function driverImportRowLabel(cells: Record<string, string>): string {
  const name = cells.full_name?.trim();
  return name ? name : '';
}
