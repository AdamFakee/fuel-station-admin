import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-4xl font-bold tracking-tight text-foreground">404</h2>
      <p className="text-base text-muted-foreground">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Quay về trang chủ</Link>
      </Button>
    </div>
  );
}
