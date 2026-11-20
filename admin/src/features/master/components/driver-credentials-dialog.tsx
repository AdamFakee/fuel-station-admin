'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CreditCardIcon,
  UserCircleIcon,
  FingerPrintIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { formatDateTimeVN } from '@/lib/format';
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

  // Face File change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      setFaceError('Ảnh vượt quá dung lượng tối đa 200 KB theo quy chuẩn máy chấm công.');
      setFaceFile(null);
      setFacePreview(null);
      return;
    }

    setFaceError('');
    setFaceFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFacePreview(objectUrl);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircleIcon className="h-6 w-6 text-primary" />
            Phương thức xác thực: {driver?.full_name} ({driver?.code})
          </DialogTitle>
          <DialogDescription>
            Quản lý thẻ NFC, nhận diện khuôn mặt và vân tay được đồng bộ trực tiếp xuống máy chấm công Hikvision ISAPI.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="card" className="w-full pt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="card" className="text-xs">
              <CreditCardIcon className="mr-1.5 h-4 w-4" />
              Thẻ từ NFC
            </TabsTrigger>
            <TabsTrigger value="face" className="text-xs">
              <UserCircleIcon className="mr-1.5 h-4 w-4" />
              Khuôn mặt
            </TabsTrigger>
            <TabsTrigger value="fingerprint" className="text-xs">
              <FingerPrintIcon className="mr-1.5 h-4 w-4" />
              Vân tay
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              Danh sách ({detail?.credentials?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CARD */}
          <TabsContent value="card" className="space-y-4 pt-3">
            <form onSubmit={handleAssignCard} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="driver-card-number">Số thẻ NFC (cardNo)</Label>
                <div className="flex gap-2">
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
                  <p className="text-xs text-muted-foreground">
                    Nhập đúng định dạng chuỗi số thập phân được đọc từ thẻ NFC MIFARE.
                  </p>
                )}
              </div>
            </form>
          </TabsContent>

          {/* TAB 2: FACE */}
          <TabsContent value="face" className="space-y-4 pt-3">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Ảnh khuôn mặt (Tối đa 200 KB)</Label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  data-testid="input-driver-face-file"
                />
                {faceError && <p className="text-xs text-destructive">{faceError}</p>}
                <p className="text-xs text-muted-foreground">
                  Chuẩn Hikvision ISAPI: Ảnh chụp chính diện, nền sáng, rõ nét, dung lượng &lt; 200 KB.
                </p>
              </div>

              {facePreview && (
                <div className="flex items-center gap-4 rounded-md border border-border p-3 bg-muted/30">
                  <img
                    src={facePreview}
                    alt="Preview khuôn mặt"
                    className="h-24 w-24 rounded-md object-cover border border-border"
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{faceFile?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Kích thước: {Math.round((faceFile?.size || 0) / 1024)} KB
                    </p>
                    <Button
                      type="button"
                      size="sm"
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
            </div>
          </TabsContent>

          {/* TAB 3: FINGERPRINT */}
          <TabsContent value="fingerprint" className="space-y-4 pt-3">
            <form onSubmit={handleRegisterFingerprint} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="driver-fingerprint-template">Mã mẫu vân tay (Biometric Template ID)</Label>
                <div className="flex gap-2">
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
                {fingerprintError && <p className="text-xs text-destructive">{fingerprintError}</p>}
                <p className="text-xs text-muted-foreground">
                  Mã mẫu sinh trắc học vân tay từ máy chấm công Hikvision hoặc đầu đọc USB.
                </p>
              </div>
            </form>
          </TabsContent>

          {/* TAB 4: CREDENTIALS LIST */}
          <TabsContent value="history" className="space-y-3 pt-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Đang tải danh sách...</p>
            ) : !detail?.credentials || detail.credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Chưa có phương thức xác thực nào.</p>
            ) : (
              <div className="space-y-2">
                {detail.credentials.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      {c.method === 'card' && <CreditCardIcon className="h-4 w-4 text-emerald-500" />}
                      {c.method === 'face' && <UserCircleIcon className="h-4 w-4 text-blue-500" />}
                      {c.method === 'fingerprint' && <FingerPrintIcon className="h-4 w-4 text-purple-500" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">
                            {c.method === 'card' ? 'Thẻ NFC' : c.method === 'face' ? 'Khuôn mặt' : 'Vân tay'}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">({c.external_id})</span>
                          {c.status === 'active' ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                              Đang hiệu lực
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Đã thu hồi
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Tạo ngày: {formatDateTimeVN(c.created_at)}
                          {c.revoked_at && ` • Thu hồi: ${formatDateTimeVN(c.revoked_at)}`}
                        </p>
                      </div>
                    </div>

                    {c.status === 'active' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:bg-destructive/10 h-8"
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
      </DialogContent>
    </Dialog>
  );
}
