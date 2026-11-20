'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { usePermissions } from '../api/get-permissions';
import { useRole } from '../api/get-role';
import { useCreateRole } from '../api/create-role';
import { useUpdateRole } from '../api/update-role';
import { PermissionItem, RoleListItem } from '../types';

interface RoleDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleListItem | null;
}

const MODULE_LABELS: Record<string, string> = {
  'iam.user': 'Tài khoản người dùng',
  'iam.role': 'Vai trò & Phân quyền',
  'audit.log': 'Nhật ký thao tác (Audit)',
  'sync.monitor': 'Giám sát đồng bộ trạm',
  'org.branch': 'Tổ chức & Chi nhánh',
  'asset.tank': 'Bể chứa nhiên liệu',
  'asset.pump': 'Trụ & Vòi bơm',
  'asset.device': 'Thiết bị & Máy chấm công',
  'master.vehicle': 'Danh mục Xe',
  'master.driver': 'Danh mục Tài xế & Thẻ',
  'master.quota': 'Hạn mức & Định mức lít',
  'master.catalog': 'Danh mục chung',
  'inventory.receipt': 'Phiếu nhập bể',
  'inventory.issue': 'Phiếu xuất điều chỉnh & hao hụt',
  'inventory.stocktake': 'Kiểm kê & Đối chiếu kho',
  'dispense.session': 'Phiên bơm & Giao dịch',
  dashboard: 'Bảng điều khiển (Dashboard)',
  report: 'Báo cáo số lít',
};

const ACTION_COLORS: Record<string, string> = {
  view: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  create: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  update: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  delete: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  approve: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  export: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
};

export function RoleDialogForm({ open, onOpenChange, role }: RoleDialogFormProps) {
  const isEdit = Boolean(role);

  const { data: allPermissions = [] } = usePermissions();
  const { data: roleDetail } = useRole(role?.id || '', { enabled: isEdit && open });
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedPerms, setSelectedPerms] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (role) {
      setCode(role.code);
      setName(role.name);
      setDescription(role.description || '');
      setError(null);
    } else {
      setCode('');
      setName('');
      setDescription('');
      setSelectedPerms([]);
      setError(null);
    }
  }, [role, open]);

  React.useEffect(() => {
    if (roleDetail && isEdit) {
      setSelectedPerms(roleDetail.permission_codes || []);
    }
  }, [roleDetail, isEdit]);

  // Group permissions by module
  const permissionsByModule = React.useMemo(() => {
    const groups: Record<string, PermissionItem[]> = {};
    for (const p of allPermissions) {
      if (!groups[p.module]) {
        groups[p.module] = [];
      }
      groups[p.module].push(p);
    }
    return groups;
  }, [allPermissions]);

  const togglePermission = (permCode: string) => {
    setSelectedPerms((prev) =>
      prev.includes(permCode) ? prev.filter((c) => c !== permCode) : [...prev, permCode]
    );
  };

  const toggleModuleAll = (modulePerms: PermissionItem[]) => {
    const moduleCodes = modulePerms.map((p) => p.code);
    const allSelected = moduleCodes.every((c) => selectedPerms.includes(c));

    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((c) => !moduleCodes.includes(c)));
    } else {
      setSelectedPerms((prev) => Array.from(new Set([...prev, ...moduleCodes])));
    }
  };

  const selectAll = () => {
    setSelectedPerms(allPermissions.map((p) => p.code));
  };

  const deselectAll = () => {
    setSelectedPerms([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Tên vai trò không được để trống');
      return;
    }

    if (isEdit && role) {
      updateRole.mutate(
        {
          id: role.id,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            permission_codes: selectedPerms,
          },
        },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err: any) => setError(err.response?.data?.message || 'Lỗi cập nhật vai trò'),
        }
      );
    } else {
      if (!code.trim()) {
        setError('Mã vai trò không được để trống');
        return;
      }

      createRole.mutate(
        {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          permission_codes: selectedPerms,
        },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err: any) => setError(err.response?.data?.message || 'Lỗi tạo vai trò'),
        }
      );
    }
  };

  const isPending = createRole.isPending || updateRole.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{isEdit ? `Chỉnh sửa vai trò: ${role?.name}` : 'Tạo vai trò mới'}</DialogTitle>
            {role?.is_system && (
              <Badge variant="secondary" className="text-xs">
                Vai trò hệ thống
              </Badge>
            )}
          </div>
          <DialogDescription>
            {isEdit
              ? 'Thiết lập ma trận phân quyền và thông tin hiển thị của vai trò'
              : 'Tạo vai trò mới và định nghĩa các quyền thao tác trên từng phân hệ'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <form id="role-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="role_code">Mã vai trò *</Label>
                <Input
                  id="role_code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: DISPATCHER"
                  disabled={isEdit || isPending}
                  required
                />
                <span className="text-[11px] text-muted-foreground">
                  Chuỗi viết hoa, không dấu (2-32 ký tự). Không thể đổi sau khi tạo.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role_name">Tên hiển thị *</Label>
                <Input
                  id="role_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Điều phối viên"
                  disabled={isPending}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role_desc">Mô tả nhiệm vụ</Label>
              <Input
                id="role_desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả phạm vi quyền hạn và trách nhiệm của vai trò này"
                disabled={isPending}
              />
            </div>

            {/* Permission Matrix */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Ma trận quyền truy cập ({selectedPerms.length}/{allPermissions.length})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Chọn các quyền hạn chức năng cụ thể được phép thao tác
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAll}
                  >
                    Chọn tất cả
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={deselectAll}
                  >
                    Bỏ chọn tất cả
                  </Button>
                </div>
              </div>

              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {Object.entries(permissionsByModule).map(([moduleName, perms]) => {
                  const moduleCodes = perms.map((p) => p.code);
                  const selectedCount = moduleCodes.filter((c) => selectedPerms.includes(c)).length;
                  const isAllChecked = selectedCount === perms.length;

                  return (
                    <div key={moduleName} className="rounded-lg border bg-card/60 p-3 space-y-2.5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`mod-${moduleName}`}
                            checked={isAllChecked}
                            onCheckedChange={() => toggleModuleAll(perms)}
                          />
                          <Label
                            htmlFor={`mod-${moduleName}`}
                            className="font-semibold text-sm cursor-pointer"
                          >
                            {MODULE_LABELS[moduleName] || moduleName}
                          </Label>
                          <span className="text-xs text-muted-foreground font-mono">({moduleName})</span>
                        </div>
                        <Badge variant="outline" className="text-[11px] tabular-nums">
                          {selectedCount}/{perms.length}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {perms.map((p) => {
                          const isChecked = selectedPerms.includes(p.code);
                          return (
                            <div
                              key={p.code}
                              onClick={() => togglePermission(p.code)}
                              className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/40 cursor-pointer border border-transparent hover:border-border transition-colors"
                            >
                              <Checkbox
                                id={`perm-${p.code}`}
                                checked={isChecked}
                                onCheckedChange={() => togglePermission(p.code)}
                                className="mt-0.5"
                              />
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] py-0 px-1 uppercase font-semibold ${
                                      ACTION_COLORS[p.action] || ''
                                    }`}
                                  >
                                    {p.action}
                                  </Badge>
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {p.code}
                                  </span>
                                </div>
                                <span className="text-xs text-foreground mt-0.5">
                                  {p.description}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Hủy
          </Button>
          <Button type="submit" form="role-form" disabled={isPending}>
            {isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo vai trò'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
