import ExcelJS from 'exceljs';
import { ImportColumn } from './types';

/** Tải về file mẫu: sheet "Dữ liệu" (tiêu đề + 1 dòng ví dụ) và sheet "Hướng dẫn". */
export async function downloadImportTemplate<TRow>(
  columns: ImportColumn<TRow>[],
  filename: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fuel Station Admin';

  const dataSheet = workbook.addWorksheet('Dữ liệu');
  dataSheet.columns = columns.map((column) => ({
    header: column.required ? `${column.header} *` : column.header,
    key: column.key,
    width: column.width ?? 20,
  }));
  const exampleRow: Record<string, string> = {};
  for (const column of columns) exampleRow[column.key] = column.example ?? '';
  dataSheet.addRow(exampleRow);

  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F6B80' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 22;
  dataSheet.getRow(2).font = { italic: true, color: { argb: 'FF94A3B8' } };
  dataSheet.views = [{ state: 'frozen', ySplit: 1 }];
  // Mọi ô là văn bản để số thẻ, số điện thoại không bị Excel đổi thành số hay mất số 0 đầu.
  columns.forEach((_, index) => {
    dataSheet.getColumn(index + 1).numFmt = '@';
  });

  const guideSheet = workbook.addWorksheet('Hướng dẫn');
  guideSheet.columns = [
    { header: 'Cột', key: 'column', width: 24 },
    { header: 'Bắt buộc', key: 'required', width: 12 },
    { header: 'Ví dụ', key: 'example', width: 22 },
    { header: 'Ghi chú', key: 'hint', width: 70 },
  ];
  guideSheet.getRow(1).font = { bold: true };
  for (const column of columns) {
    guideSheet.addRow({
      column: column.header,
      required: column.required ? 'Có' : 'Không',
      example: column.example ?? '',
      hint: column.hint ?? '',
    });
  }
  guideSheet.addRow({});
  guideSheet.addRow({
    column: 'Lưu ý: dòng 2 của sheet "Dữ liệu" là dòng ví dụ, hãy ghi đè hoặc xóa trước khi nhập.',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
