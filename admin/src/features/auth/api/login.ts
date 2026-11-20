import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { LoginInput, LoginResponse, RawUserResponse, mapAuthUser } from '../types';
import { authKeys } from './get-me';

interface RawLoginResponse {
  token?: string;
  user: RawUserResponse;
  message?: string;
}

export async function login(data: LoginInput): Promise<LoginResponse> {
  const payload = {
    username: data.username,
    password: data.password,
    remember_me: data.rememberMe,
  };
  const res = await apiClient.post<RawLoginResponse>('/auth/login', payload);
  return {
    token: res.data.token,
    user: mapAuthUser(res.data.user),
    message: res.data.message,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data.user);
    },
  });
}
