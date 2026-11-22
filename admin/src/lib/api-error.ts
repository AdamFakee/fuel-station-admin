import { toast } from 'sonner';

/**
 * Chuyển lỗi từ backend thành thông báo rõ ràng cho người dùng.
 *
 * Backend trả `{ code, message }`. Thứ tự xử lý:
 * 1. Không có phản hồi (mất mạng, hết thời gian chờ): thông báo mất kết nối.
 * 2. `code` có trong bảng ánh xạ: dùng câu đã chuẩn hóa; nếu backend nêu lý do cụ thể hơn câu chung đó
 *    (ví dụ "mã 'X' đã tồn tại") thì hiện kèm lý do này.
 * 3. `code` không ánh xạ được: hiện nguyên lỗi gốc của backend (rồi mới tới thông điệp của axios).
 */

/** Bảng ánh xạ mã lỗi backend -> câu tiếng Việt chuẩn. Khớp với câu chung backend dùng khi không có lý do cụ thể. */
const CODE_MESSAGES: Record<string, string> = {
  not_found: 'Không tìm thấy dữ liệu, có thể đã bị xóa',
  invalid_input: 'Dữ liệu nhập chưa hợp lệ, vui lòng kiểm tra lại',
  conflict: 'Dữ liệu bị trùng hoặc đang được sử dụng nên không thực hiện được thao tác này',
  unauthorized: 'Thông tin đăng nhập không chính xác hoặc phiên đăng nhập đã hết hạn',
  forbidden: 'Bạn không có quyền thực hiện thao tác này',
  internal_error: 'Hệ thống gặp sự cố, vui lòng thử lại sau',
};

/** Một số lỗi do máy chủ web hoặc đường truyền, không có `code` của backend: ánh xạ theo mã HTTP. */
const STATUS_MESSAGES: Record<number, string> = {
  413: 'Tệp tải lên quá lớn',
  429: 'Thao tác quá nhanh, vui lòng thử lại sau ít phút',
  502: 'Máy chủ đang khởi động lại, vui lòng thử lại sau ít phút',
  503: 'Hệ thống đang bảo trì, vui lòng thử lại sau ít phút',
  504: 'Máy chủ phản hồi quá lâu, vui lòng thử lại',
};

const NETWORK_MESSAGE = 'Không thể kết nối đến máy chủ, vui lòng kiểm tra đường truyền';

interface ErrorLike {
  message?: string;
  response?: { status?: number; data?: { code?: string; message?: string } | string };
}

export interface ApiErrorInfo {
  /** Câu ngắn gọn: lỗi thuộc loại nào (đã chuẩn hóa nếu mã lỗi ánh xạ được). */
  summary: string;
  /** Lý do cụ thể hơn (nếu có), ví dụ "mã 'X' đã tồn tại". */
  detail?: string;
  /** Mã lỗi backend có trong bảng ánh xạ hay không. */
  mapped: boolean;
}

export function describeApiError(error: unknown): ApiErrorInfo {
  const err = (error ?? {}) as ErrorLike;
  if (!err.response) {
    return { summary: NETWORK_MESSAGE, mapped: true };
  }

  const status = err.response.status;
  const data = typeof err.response.data === 'object' && err.response.data ? err.response.data : undefined;
  const code = data?.code;
  const backendMessage = data?.message?.trim();

  if (code && CODE_MESSAGES[code]) {
    const summary = CODE_MESSAGES[code];
    // Câu chung của backend trùng với câu chuẩn thì không hiện lại hai lần
    const isGeneric = !backendMessage || backendMessage === summary || Object.values(CODE_MESSAGES).includes(backendMessage);
    return { summary, detail: isGeneric ? undefined : backendMessage, mapped: true };
  }

  if (status && STATUS_MESSAGES[status]) {
    return { summary: STATUS_MESSAGES[status], mapped: true };
  }

  // Không ánh xạ được: cho người dùng thấy lỗi gốc để còn báo lại
  const original = backendMessage || (typeof err.response.data === 'string' ? err.response.data.trim() : '') || err.message;
  return { summary: original || 'Có lỗi xảy ra, vui lòng thử lại', mapped: false };
}

/** Chuỗi một dòng cho chỗ hiện lỗi trong form: lý do cụ thể nếu có, không thì câu chuẩn của mã lỗi. */
export function apiErrorText(error: unknown): string {
  const info = describeApiError(error);
  return info.detail ?? info.summary;
}

/**
 * Hiện toast lỗi. `context` là việc đang làm ("Không thể tạo tài khoản"): có thì làm tiêu đề,
 * còn lý do (đã ánh xạ hoặc lỗi gốc) nằm ở dòng mô tả bên dưới.
 */
export function showApiError(error: unknown, context?: string) {
  const info = describeApiError(error);
  const reason = info.detail ?? info.summary;
  if (context) {
    toast.error(context, { description: reason, id: `${context}|${reason}` });
  } else if (info.detail) {
    toast.error(info.summary, { description: info.detail, id: `${info.summary}|${info.detail}` });
  } else {
    toast.error(info.summary, { id: info.summary });
  }
}
