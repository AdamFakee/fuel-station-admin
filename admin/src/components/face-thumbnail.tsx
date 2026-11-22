'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** Địa chỉ ảnh khuôn mặt đã lưu của tài xế (cần đăng nhập; trình duyệt tự gửi cookie phiên). */
export function faceImageUrl(fileId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/master/files/${fileId}`;
}

interface FaceThumbnailProps {
  /** Mã tệp ảnh (`face_file_id`). */
  fileId?: string;
  /** Cạnh ảnh, tính bằng px. */
  size?: number;
  className?: string;
}

/** Ảnh khuôn mặt đã đăng ký, hiện nhỏ ngay trong bảng hoặc hộp chi tiết để biết đúng ảnh nào đang dùng. */
export function FaceThumbnail({ fileId, size = 32, className }: FaceThumbnailProps) {
  const [failed, setFailed] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  if (!fileId || failed) {
    return <span className="text-xs font-medium text-foreground">Đã đăng ký</span>;
  }
  const url = faceImageUrl(fileId);
  return (
    <>
      {/* Bấm vào ảnh nhỏ thì xem ảnh lớn; dừng sự kiện để không mở luôn hộp chi tiết của dòng bảng */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="cursor-zoom-in rounded-md focus-visible:ring-2 focus-visible:ring-ring"
        title="Bấm để xem ảnh lớn"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Ảnh khuôn mặt đã đăng ký"
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn('rounded-md border object-cover', className)}
          style={{ width: size, height: size }}
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="2xl" className="max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
          <DialogTitle>Ảnh khuôn mặt đã đăng ký</DialogTitle>
          <DialogDescription className="sr-only">Ảnh khuôn mặt dùng để nhận diện trên máy chấm công</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Ảnh khuôn mặt đã đăng ký" className="mx-auto max-h-[78vh] w-full rounded-md border bg-muted/30 object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
