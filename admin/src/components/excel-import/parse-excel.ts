import ExcelJS from 'exceljs';
import { ImportColumn, ParsedImportRow, RawCell } from './types';

/** Số dòng dữ liệu tối đa của một file (khớp giới hạn của server). */
export const MAX_IMPORT_ROWS = 500;

export class ImportFileError extends Error {}

/** Đổi giá trị ô của exceljs thành chuỗi đã cắt khoảng trắng. */
function cellToText(value: ExcelJS.CellValue): RawCell {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()}`;
  }
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value && value.result !== undefined) return cellToText(value.result as ExcelJS.CellValue);
    return '';
  }
  return String(value).trim();
}

/**
 * Kiểm tra một dòng: ô bắt buộc không được trống, rồi đổi kiểu từng ô bằng `parse`.
 * Dùng cả lúc đọc file lẫn lúc người dùng sửa ô trong màn hình xem trước.
 */
export function validateCells<TRow>(
  cells: RawCell[],
  columns: ImportColumn<TRow>[]
): { value: TRow; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const value: Record<string, unknown> = {};
  columns.forEach((column, i) => {
    const raw = cells[i].trim();
    if (raw === '') {
      if (column.required) errors[column.key] = 'Chưa nhập (bắt buộc)';
      return;
    }
    try {
      value[column.key] = column.parse ? column.parse(raw) : raw;
    } catch (error) {
      errors[column.key] = error instanceof Error ? error.message : 'Giá trị không hợp lệ';
    }
  });
  return { value: value as TRow, errors };
}

/** Bỏ dấu * và khoảng trắng thừa ở tiêu đề để so khớp. */
function normalizeHeader(text: string): string {
  return text.replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Đọc sheet "Dữ liệu" (hoặc sheet đầu nếu không có), ghép cột theo tiêu đề rồi kiểm tra từng dòng.
 * Dòng trống hoàn toàn được bỏ qua.
 */
export async function parseImportFile<TRow>(
  file: File,
  columns: ImportColumn<TRow>[]
): Promise<ParsedImportRow<TRow>[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new ImportFileError('Không đọc được file. Vui lòng dùng file .xlsx (tải file mẫu để có đúng định dạng).');
  }
  const sheet = workbook.getWorksheet('Dữ liệu') ?? workbook.worksheets[0];
  if (!sheet) throw new ImportFileError('File không có sheet dữ liệu.');

  // Ghép cột: tìm tiêu đề của từng cột trong dòng 1.
  const headerCells = (sheet.getRow(1).values as ExcelJS.CellValue[])
    .slice(1)
    .map((value) => normalizeHeader(cellToText(value)));
  const columnIndexes = columns.map((column) => headerCells.indexOf(normalizeHeader(column.header)));
  const missing = columns.filter((_, i) => columnIndexes[i] === -1).map((column) => column.header);
  if (missing.length > 0) {
    throw new ImportFileError(`File thiếu cột: ${missing.join(', ')}. Hãy dùng đúng file mẫu.`);
  }

  const rows: ParsedImportRow<TRow>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const sheetRow = sheet.getRow(rowNumber);
    const cells = columns.map((_, i) => cellToText(sheetRow.getCell(columnIndexes[i] + 1).value));
    if (cells.every((cell) => cell === '')) continue;

    const { value, errors } = validateCells(cells, columns);
    rows.push({ rowNumber, cells, value, errors });
  }

  if (rows.length === 0) throw new ImportFileError('File không có dòng dữ liệu nào.');
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(`File có ${rows.length} dòng, tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập.`);
  }
  return rows;
}
