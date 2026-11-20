'use client';

import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button } from './ui/button';
import { HomeIcon, ShieldExclamationIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';

let triggerPopup: () => void;

export const ForbiddenModal = () => {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    triggerPopup = () => setOpen(true);
  }, []);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/50 flex items-center justify-center">
      <div className="bg-background p-6 rounded-xl shadow-lg max-w-md text-center space-y-4 border border-border">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
          <ShieldExclamationIcon className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Hạn chế truy cập</h2>
        <p className="text-muted-foreground text-sm">
          Bạn không có quyền truy cập vào trang này.
          <br /> Nếu bạn nghĩ đây là lỗi, vui lòng liên hệ quản trị viên hệ thống.
        </p>
        <Button
          onClick={() => {
            setOpen(false);
            router.replace('/');
          }}
          className="w-full gap-2"
        >
          <HomeIcon className="h-4 w-4" />
          Về trang chủ
        </Button>
      </div>
    </div>,
    document.body
  );
};

export const show403Popup = () => {
  if (triggerPopup) triggerPopup();
};
