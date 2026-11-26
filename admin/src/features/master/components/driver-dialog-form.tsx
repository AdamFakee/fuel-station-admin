'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { faceImageUrl } from '@/components/face-thumbnail';
import { compressFaceImage } from '@/lib/compress-image';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useCreateDriver } from '../api/create-driver';
import { useUpdateDriver } from '../api/update-driver';
import { useDriver } from '../api/get-driver';
import { useUploadDriverFace } from '../api/upload-driver-face';
import { useAssignDriverCard } from '../api/assign-driver-card';
import { useRevokeDriverCredential } from '../api/revoke-driver-credential';
import { CatalogsSummary, CredentialItem, DriverListItem } from '../types';

interface DriverDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogs?: CatalogsSummary;
  driver?: DriverListItem | null;
}

type Method = CredentialItem['method'];

/**
 * Thêm hoặc sửa tài xế: họ tên, số điện thoại, thẻ NFC, ảnh khuôn mặt và ghi chú trong cùng một hộp (vân tay đang ẩn).
 * Khi sửa có thể thay hoặc gỡ thẻ, ảnh. Mọi thay đổi, kể cả gỡ, chỉ có hiệu lực khi bấm "Lưu thay đổi"; trước đó đều hoàn tác được.
 */
export function DriverDialogForm({ open, onOpenChange, driver }: DriverDialogFormProps) {
  const isEdit = !!driver;
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const uploadFace = useUploadDriverFace();
  const assignCard = useAssignDriverCard();
  const revokeCredential = useRevokeDriverCredential();

  // Các phương thức xác thực đang hiệu lực của tài xế (cần id để gỡ)
  const { data: detail } = useDriver(isEdit && open ? (driver?.id ?? '') : '');
  const active = (method: Method) => detail?.credentials?.find((c) => c.method === method && c.status === 'active');

  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [cardNumber, setCardNumber] = React.useState('');
  const [note, setNote] = React.useState('');
  const [faceFile, setFaceFile] = React.useState<File | null>(null);
  const [facePreview, setFacePreview] = React.useState<string | null>(null);
  const [faceOriginalSize, setFaceOriginalSize] = React.useState(0);
  const [removeFace, setRemoveFace] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const faceInputRef = React.useRef<HTMLInputElement>(null);

  const currentFaceUrl = isEdit && driver?.face_file_id ? faceImageUrl(driver.face_file_id) : null;

  React.useEffect(() => {
    setFullName(driver?.full_name ?? '');
    setPhone(driver?.phone ?? '');
    setCardNumber(driver?.card_number ?? '');
    setNote(driver?.note ?? '');
    setErrors({});
    setFaceFile(null);
    setFacePreview(null);
    setRemoveFace(false);
  }, [driver, open]);

  // Ảnh lớn hơn 200 KB thì tự nén, không bắt người dùng đổi ảnh
  const handleFaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaceOriginalSize(file.size);
    try {
      const prepared = await compressFaceImage(file);
      setFaceFile(prepared);
      setFacePreview(URL.createObjectURL(prepared));
      setRemoveFace(false);
      setErrors((prev) => ({ ...prev, face: '' }));
    } catch {
      setFaceFile(null);
      setFacePreview(null);
      setErrors((prev) => ({ ...prev, face: 'Không xử lý được ảnh này, hãy chọn ảnh JPG hoặc PNG khác' }));
    }
  };

  const clearFace = () => {
    setFaceFile(null);
    setFacePreview(null);
    if (faceInputRef.current) faceInputRef.current.value = '';
  };

  const activeCard = active('card');
  const activeFace = active('face');
  const originalCard = driver?.card_number ?? '';
  // Đang sửa mà ô thẻ để trống (bấm "Gỡ thẻ" hoặc tự xoá số) nghĩa là gỡ thẻ khi lưu
  const willRemoveCard = isEdit && !!originalCard && !cardNumber.trim();
  const willRemoveFace = removeFace && !faceFile;
  const shownFaceUrl = facePreview ?? (willRemoveFace ? null : currentFaceUrl);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Vui lòng nhập họ và tên';
    if (cardNumber.trim() && !/^[0-9]{1,32}$/.test(cardNumber.trim())) {
      errs.cardNumber = 'Số thẻ NFC phải là chuỗi chữ số thập phân';
    }
    // Gỡ cần mã của bản ghi đang hiệu lực; chưa tải được thì không lưu, để không im lặng bỏ qua việc gỡ
    if (willRemoveCard && !activeCard) errs.cardNumber = 'Chưa tải được thông tin thẻ đang dùng, vui lòng thử lại';
    if (willRemoveFace && !activeFace) errs.face = 'Chưa tải được thông tin ảnh đang dùng, vui lòng thử lại';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /** Các thay đổi về phương thức xác thực sau khi hồ sơ đã lưu: thẻ mới, ảnh mới, gỡ thẻ, gỡ ảnh. */
  const saveCredentials = (id: string, previousCard: string) => {
    const newCard = cardNumber.trim();
    if (newCard && newCard !== previousCard) assignCard.mutate({ id, cardNumber: newCard });
    if (faceFile) uploadFace.mutate({ id, file: faceFile });
    if (willRemoveCard && activeCard) revokeCredential.mutate({ driverId: id, credId: activeCard.id });
    if (willRemoveFace && activeFace) revokeCredential.mutate({ driverId: id, credId: activeFace.id });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEdit && driver) {
      updateDriver.mutate(
        { id: driver.id, data: { full_name: fullName.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined } },
        {
          onSuccess: () => {
            saveCredentials(driver.id, driver.card_number ?? '');
            onOpenChange(false);
          },
        }
      );
    } else {
      // Thẻ đi kèm lúc tạo; ảnh gửi sau khi có tài xế
      createDriver.mutate(
        { full_name: fullName.trim(), phone: phone.trim() || undefined, card_number: cardNumber.trim() || undefined, note: note.trim() || undefined },
        {
          onSuccess: (created) => {
            saveCredentials(created.id, cardNumber.trim());
            onOpenChange(false);
          },
        }
      );
    }
  };

  const isPending = createDriver.isPending || updateDriver.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Cập nhật hồ sơ tài xế: ${driver?.code}` : 'Thêm tài xế mới'}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? 'Chỉnh sửa họ tên, số điện thoại, thẻ NFC, ảnh khuôn mặt và ghi chú của tài xế.' : 'Nhập thông tin tài xế mới.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="driver-name">
                  Họ và tên <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="driver-name"
                  placeholder="VD: Nguyễn Văn Lái"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={errors.fullName ? 'border-destructive' : ''}
                  data-testid="input-driver-name"
                />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="driver-phone">Số điện thoại</Label>
                <Input
                  id="driver-phone"
                  placeholder="VD: 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-driver-phone"
                />
              </div>
            </div>

            {/* Ảnh khuôn mặt: sửa thì hiện ảnh đang dùng; chọn ảnh mới thì ảnh cũ bị xóa khi lưu */}
            <div className="space-y-1.5">
              <Label>Ảnh khuôn mặt</Label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                ref={faceInputRef}
                onChange={handleFaceChange}
                className="sr-only"
                data-testid="input-driver-face"
              />
              <div className="flex items-center gap-3 rounded-md border border-input bg-white p-2">
                {shownFaceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownFaceUrl} alt="Ảnh khuôn mặt" className="h-14 w-14 shrink-0 rounded-md border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                    <ArrowUpTrayIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium${willRemoveFace ? ' text-destructive' : ''}`}>
                    {faceFile ? faceFile.name : willRemoveFace ? 'Sẽ gỡ ảnh khi lưu' : currentFaceUrl ? 'Ảnh đang dùng' : 'Chưa có ảnh'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {faceFile
                      ? `${Math.round(faceFile.size / 1024)} KB${faceOriginalSize > faceFile.size ? ` (đã tự giảm từ ${Math.round(faceOriginalSize / 1024)} KB)` : ''}${currentFaceUrl ? '. Ảnh cũ sẽ bị xóa khi lưu.' : ''}`
                      : 'JPG hoặc PNG, ảnh chính diện, nền sáng, rõ nét'}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => faceInputRef.current?.click()}>
                  {shownFaceUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
                </Button>
                {faceFile ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearFace}>
                    Bỏ
                  </Button>
                ) : willRemoveFace ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveFace(false)}>
                    Hoàn tác
                  </Button>
                ) : (
                  activeFace && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        clearFace();
                        setRemoveFace(true);
                      }}
                    >
                      Gỡ ảnh
                    </Button>
                  )
                )}
              </div>
              {errors.face && <p className="text-xs text-destructive">{errors.face}</p>}
            </div>

            {/* Thẻ NFC: nhập số mới để thay thẻ cũ, để trống để gỡ */}
            <div className="space-y-1.5">
              <Label htmlFor="driver-card">Số thẻ NFC</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="driver-card"
                  placeholder="VD: 2001234567"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className={errors.cardNumber ? 'border-destructive' : ''}
                  data-testid="input-driver-card"
                />
                {willRemoveCard ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCardNumber(originalCard)}>
                    Hoàn tác
                  </Button>
                ) : (
                  activeCard && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setCardNumber('')}>
                      Gỡ thẻ
                    </Button>
                  )
                )}
              </div>
              {willRemoveCard && <p className="text-xs text-destructive">Sẽ gỡ thẻ {originalCard} khi lưu</p>}
              {errors.cardNumber && <p className="text-xs text-destructive">{errors.cardNumber}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="driver-note">Ghi chú</Label>
              <Textarea
                id="driver-note"
                rows={2}
                placeholder="Thông tin bằng lái, lưu ý vận hành..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="input-driver-note"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={isPending} data-testid="submit-driver-btn">
                {isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm tài xế'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
