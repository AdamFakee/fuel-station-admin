'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatDateTimeVN } from '@/lib/format';
import { apiKeyLabel } from '@/lib/row-details';
import { useSyncStations } from '../api/get-stations';
import { useIssueApiKey } from '../api/issue-api-key';
import { useRevokeApiKey } from '../api/revoke-api-key';
import { IssuedApiKey } from '../types';
import { IssuedKeyDialog } from './issued-key-dialog';

interface StationKeyDialogProps {
  /** Trạm xăng (chi nhánh) cần quản lý khóa. */
  branch: { id: string; code: string; name: string } | null;
  onClose: () => void;
}

/**
 * Khóa API gắn với từng trạm xăng: xem trạng thái, cấp, cấp lại, thu hồi. Dùng ở trang Trạm xăng; trang Trạng thái trạm
 * có cùng các thao tác ngay trên từng hàng. Chỉ nên mở cho người có quyền `sync.monitor:update`.
 */
export function StationKeyDialog({ branch, onClose }: StationKeyDialogProps) {
  const { data, isLoading } = useSyncStations();
  const issueKey = useIssueApiKey();
  const revokeKey = useRevokeApiKey();
  const [issued, setIssued] = React.useState<IssuedApiKey | null>(null);
  const [confirm, setConfirm] = React.useState<'reissue' | 'revoke' | null>(null);

  const station = branch ? data?.stations.find((s) => s.branch_id === branch.id) : undefined;
  const hasStation = station?.has_station ?? false;
  const hasKey = station?.has_api_key ?? false;

  const runIssue = () => {
    if (!branch) return;
    issueKey.mutate(branch.id, {
      onSuccess: (result) => {
        setConfirm(null);
        setIssued(result);
      },
    });
  };

  return (
    <>
      <Dialog open={branch !== null && issued === null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Khóa API của trạm xăng</DialogTitle>
            <DialogDescription>
              {branch?.name} ({branch?.code})
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Mỗi trạm xăng có một khóa riêng. Mini server đặt tại trạm dùng khóa này để kéo danh mục và đẩy giao dịch lên server. Server chỉ giữ bản
              băm nên không xem lại được khóa đã cấp, mất khóa thì cấp lại.
            </p>

            {isLoading ? (
              <p className="py-4 text-center text-muted-foreground">Đang tải...</p>
            ) : (
              <div className="divide-y rounded-md border">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">Trạng thái khóa</span>
                  {hasKey ? (
                    <StatusBadge tone="success">Đang hiệu lực</StatusBadge>
                  ) : hasStation ? (
                    <StatusBadge tone="neutral">Đã thu hồi</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Chưa cấp</StatusBadge>
                  )}
                </div>
                {hasStation && (
                  <>
                    {hasKey && (
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-muted-foreground">Khóa đang dùng</span>
                        <span className="font-mono text-xs">{apiKeyLabel(hasKey, station?.api_key_hint, true)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-muted-foreground">Mã trạm (station_id trong edge.conf)</span>
                      <span className="font-mono text-xs font-medium">{station?.code}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-muted-foreground">Kết nối</span>
                      <StatusBadge tone={station?.is_online ? 'success' : 'neutral'}>{station?.is_online ? 'Online' : 'Offline'}</StatusBadge>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-muted-foreground">Lần thấy cuối</span>
                      <span className="text-xs tabular-nums">{formatDateTimeVN(station?.last_seen_at)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            {hasKey ? (
              <>
                <Button variant="outline" className="text-destructive" onClick={() => setConfirm('revoke')}>
                  Thu hồi
                </Button>
                <Button onClick={() => setConfirm('reissue')}>Cấp lại khóa</Button>
              </>
            ) : (
              <Button disabled={isLoading || issueKey.isPending} onClick={runIssue}>
                {issueKey.isPending ? 'Đang cấp...' : 'Cấp khóa'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IssuedKeyDialog
        issued={issued}
        onClose={() => {
          setIssued(null);
          onClose();
        }}
      />

      <ConfirmDialog
        open={confirm === 'reissue'}
        onOpenChange={(open) => !open && setConfirm(null)}
        level="security"
        title="Cấp lại khóa API"
        description={branch ? `${branch.name} (${branch.code})` : undefined}
        consequences={[
          'Khóa cũ mất hiệu lực ngay lập tức.',
          'Trạm mất kết nối với server cho đến khi bạn đặt khóa mới vào mini server.',
          'Dữ liệu chưa gửi vẫn nằm trong hàng đợi của trạm và tự gửi bù khi kết nối lại.',
        ]}
        confirmText="Cấp lại khóa"
        loading={issueKey.isPending}
        onConfirm={runIssue}
      />

      <ConfirmDialog
        open={confirm === 'revoke'}
        onOpenChange={(open) => !open && setConfirm(null)}
        level="security"
        title="Thu hồi khóa API"
        description={branch ? `${branch.name} (${branch.code})` : undefined}
        consequences={[
          'Khóa hiện tại mất hiệu lực ngay, trạm chuyển sang ngừng hoạt động.',
          'Trạm không đẩy được dữ liệu lên server cho đến khi cấp khóa mới.',
        ]}
        confirmText="Thu hồi"
        loading={revokeKey.isPending}
        onConfirm={() => branch && revokeKey.mutate(branch.id, { onSuccess: () => setConfirm(null) })}
      />
    </>
  );
}
