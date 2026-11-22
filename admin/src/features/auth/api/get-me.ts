import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { AuthUser, RawUserResponse, mapAuthUser } from '../types';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export async function getMe(): Promise<AuthUser> {
  const res = await apiClient.get<RawUserResponse | { user: RawUserResponse }>('/auth/me');
  const raw = res.data && 'user' in res.data ? res.data.user : (res.data as RawUserResponse);
  return mapAuthUser(raw);
}

// Lưu người dùng lần trước trong tab (sessionStorage) để lần tải lại trang vẫn hiện ngay sidebar và trang,
// còn phiên đăng nhập thật vẫn được kiểm tra lại ở nền: hết hạn thì về trang đăng nhập như cũ.
const CACHE_KEY = 'fs.last-user';

function readCachedUser(): AuthUser | undefined {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedUser(user: AuthUser | null) {
  try {
    if (user) window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Trình duyệt chặn storage: bỏ qua, chỉ mất phần hiện sớm.
  }
}

/** Xóa người dùng đã lưu (khi đăng xuất hoặc phiên hết hạn). */
export function clearCachedUser() {
  writeCachedUser(null);
}

const subscribeNothing = () => () => {};

export function useMe(options?: { enabled?: boolean }) {
  // Chỉ đọc storage sau khi đã chạy trên trình duyệt: bản dựng sẵn trên server không có nó, tránh lệch khi hydrate.
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      try {
        const user = await getMe();
        writeCachedUser(user);
        return user;
      } catch (error) {
        writeCachedUser(null);
        throw error;
      }
    },
    placeholderData: () => (isClient ? readCachedUser() : undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    enabled: options?.enabled ?? true,
  });
}
