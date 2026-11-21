'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ChatBubbleLeftEllipsisIcon, CursorArrowRaysIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { startElementPicker, type PickedElement } from '@/lib/element-picker';
import { cn } from '@/lib/utils';
import { useCreateFeedback } from '../api/feedback';
import { FEEDBACK_KINDS, type FeedbackKind } from '../types';

/**
 * Nút "Góp ý" nổi ở góc màn hình, hiện với mọi người dùng có quyền gửi góp ý.
 * Người dùng chọn loại, viết nội dung và (tùy chọn) chỉ vào đúng phần tử trên màn hình đang góp ý.
 */
export function FeedbackLauncher() {
  const { hasPermission } = useAuth();
  const createFeedback = useCreateFeedback();

  const [open, setOpen] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [kind, setKind] = React.useState<FeedbackKind>('improvement');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [element, setElement] = React.useState<PickedElement | null>(null);
  const stopPickerRef = React.useRef<(() => void) | null>(null);

  // Rời trang khi đang chọn thì dừng chế độ chọn.
  React.useEffect(() => () => stopPickerRef.current?.(), []);

  if (!hasPermission('feedback.item:create')) return null;

  const reset = () => {
    setKind('improvement');
    setTitle('');
    setDescription('');
    setElement(null);
  };

  const beginPicking = () => {
    setOpen(false);
    setPicking(true);
    // Chờ hộp thoại đóng hẳn rồi mới bắt sự kiện, tránh bắt luôn lần bấm đóng.
    window.setTimeout(() => {
      stopPickerRef.current = startElementPicker({
        onPick: (picked) => {
          stopPickerRef.current = null;
          setElement(picked);
          setPicking(false);
          setOpen(true);
        },
        onCancel: () => {
          stopPickerRef.current = null;
          setPicking(false);
          setOpen(true);
        },
      });
    }, 150);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung góp ý');
      return;
    }
    await createFeedback.mutateAsync({
      kind,
      title: title.trim(),
      description: description.trim(),
      page_url: window.location.href,
      page_title: document.title,
      element: element ?? undefined,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      user_agent: navigator.userAgent,
    });
    toast.success('Đã gửi góp ý, cảm ơn bạn!');
    reset();
    setOpen(false);
  };

  return (
    <>
      {!picking && !open && (
        <button
          type="button"
          data-feedback-ui
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl bg-primary px-3 py-3 text-xs font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover"
          data-testid="feedback-launcher"
        >
          <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
          Góp ý
        </button>
      )}

      {picking && (
        <div
          data-feedback-ui
          className="fixed left-1/2 top-4 z-[2147483647] flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-xl"
        >
          <CursorArrowRaysIcon className="h-5 w-5" />
          Bấm vào phần tử cần góp ý
          <button
            type="button"
            className="rounded-full bg-background/20 px-3 py-0.5 text-xs hover:bg-background/30"
            onClick={() => {
              stopPickerRef.current?.();
              stopPickerRef.current = null;
              setPicking(false);
              setOpen(true);
            }}
          >
            Esc để hủy
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="max-h-[90vh]" data-feedback-ui>
          <form onSubmit={submit} className="contents">
            <DialogHeader>
              <DialogTitle>Gửi góp ý</DialogTitle>
              <DialogDescription>
                Góp ý về tính năng, giao diện, lỗi hoặc nghiệp vụ. Có thể chỉ thẳng vào chỗ cần sửa trên màn hình.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-5 py-2">
              <div className="space-y-2">
                <Label>Loại góp ý</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FEEDBACK_KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className={cn(
                        'rounded-lg border px-4 py-3 text-left transition-colors',
                        kind === k.value ? 'border-primary bg-primary-subtle' : 'bg-card hover:bg-muted/50'
                      )}
                      data-testid={`feedback-kind-${k.value}`}
                    >
                      <p className="text-sm font-medium">{k.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feedback-title">Tiêu đề *</Label>
                <Input
                  id="feedback-title"
                  value={title}
                  maxLength={200}
                  placeholder="Tóm tắt trong một câu"
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="feedback-title"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feedback-description">Nội dung *</Label>
                <Textarea
                  id="feedback-description"
                  value={description}
                  maxLength={5000}
                  rows={5}
                  placeholder="Mô tả vấn đề hoặc mong muốn. Nếu là lỗi, nêu các bước để gặp lại."
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="feedback-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Phần tử trên màn hình</Label>
                {element ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="font-medium">
                        &lt;{element.tag}&gt;
                        {element.text && <span className="font-normal text-muted-foreground"> “{element.text.slice(0, 60)}”</span>}
                      </p>
                      {element.component && <p className="truncate text-xs text-muted-foreground">{element.component}</p>}
                      <p className="truncate font-mono text-xs text-muted-foreground">{element.selector}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={beginPicking}>
                        Chọn lại
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setElement(null)} title="Bỏ chọn">
                        <XMarkIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={beginPicking} className="w-full" data-testid="feedback-pick">
                    <CursorArrowRaysIcon className="mr-2 h-4 w-4" />
                    Chọn phần tử trên màn hình
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Không bắt buộc, nhưng giúp người xử lý tìm đúng chỗ nhanh hơn.</p>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Đóng
              </Button>
              <Button type="submit" disabled={createFeedback.isPending} data-testid="feedback-submit">
                {createFeedback.isPending ? 'Đang gửi...' : 'Gửi góp ý'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
