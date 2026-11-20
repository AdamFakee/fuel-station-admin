'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { EyeIcon, EyeSlashIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { loginSchema, LoginInput } from '../types';
import { useLogin } from '../api/login';

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  });

  const rememberMe = watch('rememberMe');

  const onSubmit = async (data: LoginInput) => {
    try {
      await loginMutation.mutateAsync(data);
      toast.success('Đăng nhập thành công');
      router.push('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr?.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác';
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Tên đăng nhập */}
      <div className="space-y-1.5">
        <Label htmlFor="username">Tên đăng nhập</Label>
        <Input
          id="username"
          placeholder="quản_lý hoặc mã nhân viên"
          autoComplete="username"
          disabled={loginMutation.isPending}
          {...register('username')}
          className={errors.username ? 'border-destructive focus-visible:ring-destructive' : ''}
        />
        {errors.username && (
          <p className="text-xs text-destructive">{errors.username.message}</p>
        )}
      </div>

      {/* Mật khẩu */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mật khẩu</Label>
          <a
            href="#forgot-password"
            onClick={(e) => {
              e.preventDefault();
              toast.info('Tính năng quên mật khẩu qua email sẽ sẵn sàng ở Module M1');
            }}
            className="text-xs text-primary hover:underline"
          >
            Quên mật khẩu?
          </a>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loginMutation.isPending}
            {...register('password')}
            className={`pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeSlashIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle password visibility</span>
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Ghi nhớ đăng nhập */}
      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="rememberMe"
          checked={rememberMe}
          onCheckedChange={(checked) => setValue('rememberMe', !!checked)}
          disabled={loginMutation.isPending}
        />
        <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground cursor-pointer">
          Ghi nhớ đăng nhập trên thiết bị này
        </Label>
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full mt-2"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            <span>Đang xác thực...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span>Đăng nhập</span>
            <ArrowRightIcon className="h-4 w-4" />
          </div>
        )}
      </Button>
    </form>
  );
}
