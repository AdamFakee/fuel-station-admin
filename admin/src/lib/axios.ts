import axios from 'axios';
import { showApiError } from '@/lib/api-error';
import { show403Popup } from '@/components/forbidden-modal';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  withCredentials: true, // Server-side HttpOnly cookie session
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Yêu cầu tải dữ liệu (GET) thì không có nơi nào khác báo lỗi, nên báo ở đây. */
function isReadRequest(error: { config?: { method?: string } }) {
  return (error.config?.method ?? 'get').toLowerCase() === 'get';
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Session hết hạn hoặc bị thu hồi -> Chuyển về trang đăng nhập
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    } else if (status === 403 && isReadRequest(error)) {
      // Tải dữ liệu của trang bị từ chối (không đủ quyền xem trang) -> Hiển thị Modal 403, KHÔNG tự động logout.
      // Thao tác ghi (duyệt, sửa, xóa) bị 403 thì KHÔNG hiện hộp này: nơi gọi báo lý do cụ thể (quyền hay quy tắc nghiệp vụ).
      show403Popup();
    } else if (isReadRequest(error) && (!error.response || status >= 500)) {
      // Lỗi mạng, timeout hoặc 5xx khi TẢI dữ liệu -> báo lỗi (đã ánh xạ theo mã lỗi), KHÔNG mặc định logout.
      // Thao tác ghi (tạo, sửa, xóa) tự báo lỗi kèm tên việc đang làm nên không báo lặp ở đây.
      showApiError(error);
    }

    return Promise.reject(error);
  }
);
