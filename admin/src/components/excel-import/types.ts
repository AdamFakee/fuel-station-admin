/**
 * Khung nhập dữ liệu từ Excel dùng chung.
 *
 * Mỗi màn hình chỉ cần khai báo danh sách cột (`ImportColumn`) và hàm gửi dữ liệu lên server (`onImport`);
 * tải file mẫu, đọc file, kiểm tra từng dòng và xem trước đều do khung lo.
 */

/** Giá trị thô của một ô sau khi đọc: luôn là chuỗi đã cắt khoảng trắng ("" nếu ô trống). */
export type RawCell = string;

export interface ImportColumn<TRow> {
  /** Tên trường trong dữ liệu gửi lên server. */
  key: keyof TRow & string;
  /** Tiêu đề cột trong file Excel. Phải khớp khi đọc lại, nên không đổi tùy tiện. */
  header: string;
  /** Cột bắt buộc: ô trống sẽ báo lỗi. Tiêu đề trong file mẫu có thêm dấu *. */
  required?: boolean;
  /** Độ rộng cột trong file mẫu. */
  width?: number;
  /** Giá trị mẫu điền ở dòng ví dụ của file mẫu. */
  example?: string;
  /** Giải thích hiển thị ở sheet Hướng dẫn và làm gợi ý khi bổ sung dữ liệu thiếu. */
  hint?: string;
  /** Gợi ý trong ô nhập khi bổ sung dữ liệu thiếu. */
  placeholder?: string;
  /**
   * Đổi chuỗi thô sang giá trị gửi lên server, hoặc ném `Error` với thông báo lỗi tiếng Việt.
   * Không khai báo thì giữ nguyên chuỗi. Chỉ được gọi khi ô không trống.
   */
  parse?: (raw: RawCell) => unknown;
}

/** Cách gọi tên một dòng trong thông báo, ví dụ "Nguyễn Văn A (Mã NV: TX001)". Không khai báo thì dùng "Dòng N". */
export type RowLabel = (cells: Record<string, RawCell>) => string;

/** Một dòng sau khi đọc và kiểm tra. */
export interface ParsedImportRow<TRow> {
  /** Số dòng trong file Excel (dòng tiêu đề là 1, dữ liệu bắt đầu từ 2). */
  rowNumber: number;
  /** Các ô thô theo thứ tự cột, để hiển thị xem trước. */
  cells: RawCell[];
  /** Dữ liệu đã đổi kiểu; chỉ đáng tin khi `errors` rỗng. */
  value: TRow;
  /** Lỗi theo từng cột (khóa là `ImportColumn.key`). Rỗng nghĩa là dòng hợp lệ. */
  errors: Record<string, string>;
}

/** Kết quả server trả về sau khi nhập. `row` đếm từ 1 theo thứ tự các dòng hợp lệ đã gửi. */
export interface ImportOutcome {
  created: number;
  failed: { row: number; code?: string; message: string }[];
}
