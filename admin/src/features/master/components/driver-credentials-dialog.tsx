'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CreditCardIcon,
  UserCircleIcon,
  FingerPrintIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { formatDateTimeVN } from '@/lib/format';
import { compressFaceImage } from '@/lib/compress-image';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import { DriverListItem } from '../types';
import { useDriver } from '../api/get-driver';
import { useAssignDriverCard } from '../api/assign-driver-card';
import { useUploadDriverFace } from '../api/upload-driver-face';
import { useRegisterDriverFingerprint } from '../api/register-driver-fingerprint';
import { useRevokeDriverCredential } from '../api/revoke-driver-credential';

interface DriverCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: DriverListItem | null;
}

export function DriverCredentialsDialog({
  open,
  onOpenChange,
  driver,
}: DriverCredentialsDialogProps) {
  const driverId = driver?.id || '';
  const { data: detail, isLoading, refetch } = useDriver(driverId);

  const assignCard = useAssignDriverCard();
  const uploadFace = useUploadDriverFace();
  const registerFingerprint = useRegisterDriverFingerprint();
  const revokeCred = useRevokeDriverCredential();

  // Card Tab state
  const [cardNumber, setCardNumber] = React.useState('');
  const [cardError, setCardError] = React.useState('');

  // Face Tab state
  const [faceFile, setFaceFile] = React.useState<File | null>(null);
  const [facePreview, setFacePreview] = React.useState<string | null>(null);
  const [faceError, setFaceError] = React.useState('');
  const [faceOriginalSize, setFaceOriginalSize] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fingerprint Tab state
  const [fingerprintTemplate, setFingerprintTemplate] = React.useState('');
  const [fingerprintError, setFingerprintError] = React.useState('');

  React.useEffect(() => {
    setCardNumber(driver?.card_number || '');
    setCardError('');
    setFaceFile(null);
    setFacePreview(null);
    setFaceError('');
    setFingerprintTemplate('');
    setFingerprintError('');
  }, [driver, open]);

  // Card Submit
  const handleAssignCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    const trimmed = cardNumber.trim();
    if (!trimmed) {
      setCardError('Vui lòng nhập số thẻ NFC');
      return;
    }
    if (!/^[0-9]{1,32}$/.test(trimmed)) {
      setCardError('Số thẻ NFC phải là chuỗi số thập phân (VD: 2001234567)');
      return;
    }

    assignCard.mutate(
      { id: driver.id, cardNumber: trimmed },
      {
        onSuccess: () => {
          refetch();
          setCardError('');
        },
      }
    );
  };

  // Chọn ảnh: lớn hơn 200 KB thì tự nén xuống, không bắt người dùng đổi ảnh
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFaceError('');
    setFaceOriginalSize(file.size);
    try {
      const prepared = await compressFaceImage(file);
      setFaceFile(prepared);
      setFacePreview(URL.createObjectURL(prepared));
    } catch {
      setFaceError('Không xử lý được ảnh này. Vui lòng chọn ảnh JPG hoặc PNG khác.');
      setFaceFile(null);
      setFacePreview(null);
    }
  };

  // Face Upload
  const handleUploadFace = () => {
    if (!driver || !faceFile) return;

    uploadFace.mutate(
      { id: driver.id, file: faceFile },
      {
        onSuccess: () => {
          refetch();
          setFaceFile(null);
          setFacePreview(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      }
    );
  };

  // Fingerprint Submit
  const handleRegisterFingerprint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    const trimmed = fingerprintTemplate.trim();
    if (!trimmed) {
      setFingerprintError('Vui lòng nhập mã mẫu sinh trắc học vân tay');
      return;
    }

    registerFingerprint.mutate(
      { id: driver.id, biometricTemplateId: trimmed },
      {
        onSuccess: () => {
          refetch();
          setFingerprintTemplate('');
          setFingerprintError('');
        },
      }
    );
  };

  // Revoke Credential
  const handleRevoke = (credId: string) => {
    if (!driver) return;
    revokeCred.mutate(
      { driverId: driver.id, credId },
      { onSuccess: () => refetch() }
    );
  };

  const methodLabel = (method: string) => (method === 'card' ? 'Thẻ NFC' : method === 'face' ? 'Khuôn mặt' : 'Vân tay');
  const compressed = faceFile && faceOriginalSize > faceFile.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircleIcon className="h-6 w-6 shrink-0 text-primary" />
            Phương thức xác thực
          </DialogTitle>
          <DialogDescription>
            {driver?.full_name} <span className="font-mono">({driver?.code})</span> — đồng bộ xuống máy chấm công
            Hikvision.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Tabs defaultValue="card" className="gap-6 pt-2">
            <TabsList>
              <TabsTrigger value="card">
                <CreditCardIcon className="mr-1.5 h-4 w-4" />
                Thẻ NFC
              </TabsTrigger>
              <TabsTrigger value="face">
                <UserCircleIcon className="mr-1.5 h-4 w-4" />
                Khuôn mặt
              </TabsTrigger>
              <TabsTrigger value="fingerprint">
                <FingerPrintIcon className="mr-1.5 h-4 w-4" />
                Vân tay
              </TabsTrigger>
              <TabsTrigger value="history">Đã đăng ký ({detail?.credentials?.length || 0})</TabsTrigger>
            </TabsList>

            {/* THẺ NFC */}
            <TabsContent value="card">
              <form onSubmit={handleAssignCard} className="space-y-3 rounded-lg border bg-card p-5">
                <Label htmlFor="driver-card-number">Số thẻ NFC</Label>
                <div className="flex gap-3">
                  <Input
                    id="driver-card-number"
                    placeholder="VD: 3862658937"
                    value={cardNumber}
                    onChange={(e) => {
                      setCardNumber(e.target.value);
                      setCardError('');
                    }}
                    className={cardError ? 'border-destructive' : ''}
                    data-testid="input-driver-card-modal"
                  />
                  <Button type="submit" disabled={assignCard.isPending} data-testid="submit-driver-card-btn">
                    {assignCard.isPending ? 'Đang lưu...' : 'Gán thẻ'}
                  </Button>
                </div>
                {cardError ? (
                  <p className="text-xs text-destructive">{cardError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Chuỗi số thập phân đọc từ thẻ NFC MIFARE.</p>
                )}
              </form>
            </TabsContent>

            {/* KHUÔN MẶT */}
            <TabsContent value="face" className="space-y-4">
              <div className="space-y-3 rounded-lg border bg-card p-5">
                <Label>Ảnh khuôn mặt</Label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="sr-only"
                  data-testid="input-driver-face-file"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-input px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary-subtle hover:text-primary-subtle-foreground"
                >
                  <ArrowUpTrayIcon className="h-6 w-6" />
                  <span className="font-medium">{faceFile ? 'Chọn ảnh khác' : 'Chọn ảnh từ máy tính'}</span>
                  <span className="text-xs">JPG hoặc PNG, ảnh chính diện, nền sáng, rõ nét</span>
                </button>
                {faceError && <p className="text-xs text-destructive">{faceError}</p>}
              </div>

              {facePreview && (
                <div className="flex items-center gap-5 rounded-lg border bg-card p-5">
                  <img
                    src={facePreview}
                    alt="Xem trước khuôn mặt"
                    className="h-28 w-28 shrink-0 rounded-md border object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <p className="truncate text-sm font-medium">{faceFile?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round((faceFile?.size || 0) / 1024)} KB
                        {compressed && ` (đã tự giảm từ ${Math.round(faceOriginalSize / 1024)} KB)`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleUploadFace}
                      disabled={uploadFace.isPending}
                      data-testid="upload-face-btn"
                    >
                      <ArrowUpTrayIcon className="mr-1.5 h-4 w-4" />
                      {uploadFace.isPending ? 'Đang tải lên...' : 'Lưu ảnh khuôn mặt'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* VÂN TAY */}
            <TabsContent value="fingerprint">
              <form onSubmit={handleRegisterFingerprint} className="space-y-3 rounded-lg border bg-card p-5">
                <Label htmlFor="driver-fingerprint-template">Mã mẫu vân tay</Label>
                <div className="flex gap-3">
                  <Input
                    id="driver-fingerprint-template"
                    placeholder="VD: FP-TEMP-001"
                    value={fingerprintTemplate}
                    onChange={(e) => {
                      setFingerprintTemplate(e.target.value);
                      setFingerprintError('');
                    }}
                    className={fingerprintError ? 'border-destructive' : ''}
                    data-testid="input-driver-fingerprint"
                  />
                  <Button type="submit" disabled={registerFingerprint.isPending} data-testid="submit-fingerprint-btn">
                    {registerFingerprint.isPending ? 'Đang lưu...' : 'Đăng ký mẫu'}
                  </Button>
                </div>
                {fingerprintError ? (
                  <p className="text-xs text-destructive">{fingerprintError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Mã mẫu lấy từ máy chấm công Hikvision hoặc đầu đọc USB.
                  </p>
                )}
              </form>
            </TabsContent>

            {/* DANH SÁCH */}
            <TabsContent value="history">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Đang tải danh sách...</p>
              ) : !detail?.credentials || detail.credentials.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Chưa có phương thức xác thực nào.</p>
              ) : (
                <div className="space-y-3">
                  {detail.credentials.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {c.method === 'card' && <CreditCardIcon className="h-5 w-5 shrink-0 text-muted-foreground" />}
                        {c.method === 'face' && <UserCircleIcon className="h-5 w-5 shrink-0 text-muted-foreground" />}
                        {c.method === 'fingerprint' && (
                          <FingerPrintIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{methodLabel(c.method)}</span>
                            <span className="font-mono text-xs text-muted-foreground">{c.external_id}</span>
                            <StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>
                              {c.status === 'active' ? 'Đang hiệu lực' : 'Đã thu hồi'}
                            </StatusBadge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Tạo {formatDateTimeVN(c.created_at)}
                            {c.revoked_at && ` · Thu hồi ${formatDateTimeVN(c.revoked_at)}`}
                          </p>
                        </div>
                      </div>

                      {c.status === 'active' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevoke(c.id)}
                          disabled={revokeCred.isPending}
                          data-testid={`revoke-cred-${c.id}`}
                        >
                          <TrashIcon className="mr-1 h-3.5 w-3.5" />
                          Thu hồi
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
