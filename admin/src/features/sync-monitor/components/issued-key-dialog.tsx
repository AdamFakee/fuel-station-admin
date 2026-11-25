'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ClipboardDocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IssuedApiKey } from '../types';

interface IssuedKeyDialogProps {
  issued: IssuedApiKey | null;
  onClose: () => void;
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${what}`);
  } catch {
    toast.error('Không sao chép được, hãy bôi đen và sao chép thủ công');
  }
}

/** Hiện khóa API vừa cấp đúng một lần: đóng hộp này là không xem lại được nữa (server chỉ giữ bản băm). */
export function IssuedKeyDialog({ issued, onClose }: IssuedKeyDialogProps) {
  const [confirmed, setConfirmed] = React.useState(false);

  React.useEffect(() => {
    if (issued) setConfirmed(false);
  }, [issued]);

  return (
    <Dialog open={issued !== null} onOpenChange={(open) => !open && confirmed && onClose()}>
      <DialogContent size="md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => !confirmed && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{issued?.reissued ? 'Đã cấp lại khóa API' : 'Đã cấp khóa API'}</DialogTitle>
          <DialogDescription>Trạm {issued?.station_code}</DialogDescription>
        </DialogHeader>

        {issued && (
          <DialogBody className="space-y-4">
            <div className="flex gap-2 rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Khóa chỉ hiện <b>một lần duy nhất</b>. Hãy sao chép và cất ngay, đóng hộp này là không xem lại được.
                {issued.reissued && ' Khóa cũ đã mất hiệu lực: trạm sẽ mất kết nối cho đến khi bạn đặt khóa mới vào mini server.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Khóa API</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">{issued.api_key}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => void copy(issued.api_key, 'khóa API')}>
                  <ClipboardDocumentIcon className="mr-1.5 h-4 w-4" /> Sao chép
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Đặt khóa vào mini server (SSH vào máy rồi chạy)</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Linux:</p>
                <code className="block rounded-md border bg-muted px-3 py-2 font-mono text-foreground">sudo ./install.sh set-token</code>
                <p>Windows (PowerShell chạy bằng Administrator):</p>
                <code className="block rounded-md border bg-muted px-3 py-2 font-mono text-foreground">.\install.ps1 -Action set-token</code>
                <p>
                  Lệnh sẽ hỏi khóa (dán khóa ở trên), ghi vào <span className="font-mono">edge.conf</span> rồi khởi động lại dịch vụ. Khóa này tự xác định trạm, không cần nhập mã trạm.
                </p>
              </div>
            </div>
          </DialogBody>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Tôi đã lưu khóa này
          </label>
          <Button onClick={onClose} disabled={!confirmed}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
