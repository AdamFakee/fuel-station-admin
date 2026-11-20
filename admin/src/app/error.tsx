'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-2xl font-bold text-destructive">Đã xảy ra lỗi!</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || 'Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Thử lại
      </Button>
    </div>
  );
}
