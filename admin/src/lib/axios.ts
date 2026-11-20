import axios from 'axios';
import { toast } from 'sonner';
import { show403Popup } from '@/components/forbidden-modal';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  withCredentials: true, // Server-side HttpOnly cookie session
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Session hết hạn hoặc bị thu hồi -> Chuyển về trang đăng nhập
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    } else if (status === 403) {
      // Thiếu quyền -> Hiển thị Modal 403, KHÔNG tự động logout
      show403Popup();
    } else if (!error.response) {
      // Lỗi mạng hoặc Timeout -> Báo lỗi kết nối, KHÔNG mặc định logout
      toast.error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền.');
    } else if (status >= 500) {
      // Lỗi Server 5xx -> Báo lỗi dịch vụ, KHÔNG mặc định logout
      toast.error(error.response?.data?.message || 'Hệ thống xảy ra lỗi. Vui lòng thử lại sau.');
    }

    return Promise.reject(error);
  }
);
