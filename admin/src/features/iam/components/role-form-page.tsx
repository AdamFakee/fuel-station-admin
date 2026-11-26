'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '../api/get-permissions';
import { useRole } from '../api/get-role';
import { useCreateRole } from '../api/create-role';
import { useUpdateRole } from '../api/update-role';
import { PermissionItem } from '../types';
import { apiErrorText } from '@/lib/api-error';

const MODULE_LABELS: Record<string, string> = {
  'iam.user': 'Tài khoản người dùng',
  'iam.role': 'Vai trò & Phân quyền',
  'audit.log': 'Nhật ký thao tác (Audit)',
  'feedback.item': 'Góp ý & Phản hồi',
  'sync.monitor': 'Giám sát đồng bộ trạm',
  'org.branch': 'Tổ chức & Trạm xăng',
  'asset.tank': 'Bể chứa nhiên liệu',
  'asset.pump': 'Trụ & Vòi bơm',
  'asset.device': 'Thiết bị & Máy chấm công',
  'master.vehicle': 'Danh mục Xe',
  'master.driver': 'Danh mục Tài xế & Thẻ',
  'master.catalog': 'Danh mục chung',
  'inventory.receipt': 'Phiếu nhập bể',
  'inventory.issue': 'Phiếu xuất điều chỉnh & hao hụt',
  'dispense.session': 'Phiên bơm & Giao dịch',
  dashboard: 'Dashboard',
  report: 'Báo cáo số lít',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'Xem',
  create: 'Tạo',
  update: 'Sửa',
  delete: 'Xóa',
  approve: 'Duyệt',
  export: 'Xuất',
};

const ACTION_COLORS: Record<string, string> = {
  view: 'bg-blue-500/10 text-blue-600',
  create: 'bg-emerald-500/10 text-emerald-600',
  update: 'bg-amber-500/10 text-amber-600',
  delete: 'bg-rose-500/10 text-rose-600',
  approve: 'bg-purple-500/10 text-purple-600',
  export: 'bg-indigo-500/10 text-indigo-600',
};

interface RoleFormPageProps {
  /** Có id thì là sửa vai trò, không có thì là tạo mới. */
  roleId?: string;
}

/**
 * Trang tạo / sửa vai trò (toàn màn hình, thay cho hộp thoại nhỏ):
 * thông tin vai trò ở trên, ma trận quyền chia theo phân hệ bên dưới, nút Lưu và Hủy ở thanh đầu trang.
 */
export function RoleFormPage({ roleId }: RoleFormPageProps) {
  const router = useRouter();
  const isEdit = Boolean(roleId);

  const { data: allPermissions = [] } = usePermissions();
  const { data: roleDetail, isLoading: isRoleLoading } = useRole(roleId ?? '', { enabled: isEdit });
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedPerms, setSelectedPerms] = React.useState<string[]>([]);
  const [permSearch, setPermSearch] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Nạp dữ liệu vai trò khi sửa
  React.useEffect(() => {
    if (roleDetail) {
      setCode(roleDetail.code);
      setName(roleDetail.name);
      setDescription(roleDetail.description || '');
      setSelectedPerms(roleDetail.permission_codes || []);
    }
  }, [roleDetail]);

  const filteredPermissions = React.useMemo(() => {
    const keyword = permSearch.trim().toLowerCase();
    if (!keyword) return allPermissions;
    return allPermissions.filter(
      (p) =>
        p.code.toLowerCase().includes(keyword) ||
        (p.description || '').toLowerCase().includes(keyword) ||
        (MODULE_LABELS[p.module] || p.module).toLowerCase().includes(keyword),
    );
  }, [allPermissions, permSearch]);

  const permissionsByModule = React.useMemo(() => {
    const groups: Record<string, PermissionItem[]> = {};
    for (const p of filteredPermissions) {
      (groups[p.module] ??= []).push(p);
    }
    return groups;
  }, [filteredPermissions]);

  const togglePermission = (permCode: string) => {
    setSelectedPerms((prev) => (prev.includes(permCode) ? prev.filter((c) => c !== permCode) : [...prev, permCode]));
  };

  // Quyền dành riêng cho Quản trị hệ thống không cấp được cho vai trò nào ở đây
  const grantableCodes = (perms: PermissionItem[]) => perms.filter((p) => !p.super_admin_only).map((p) => p.code);

  const toggleModuleAll = (modulePerms: PermissionItem[]) => {
    const moduleCodes = grantableCodes(modulePerms);
    const allSelected = moduleCodes.every((c) => selectedPerms.includes(c));
    setSelectedPerms((prev) =>
      allSelected ? prev.filter((c) => !moduleCodes.includes(c)) : Array.from(new Set([...prev, ...moduleCodes])),
    );
  };

  const goBack = () => router.push('/roles');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Tên vai trò không được để trống');
      return;
    }

    if (isEdit && roleId) {
      updateRole.mutate(
        {
          id: roleId,
          data: { name: name.trim(), description: description.trim() || undefined, permission_codes: selectedPerms },
        },
        {
          onSuccess: goBack,
          onError: (err: any) => setError(apiErrorText(err)),
        },
      );
      return;
    }

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
        onSuccess: goBack,
        onError: (err: any) => setError(apiErrorText(err)),
      },
    );
  };

  const isPending = createRole.isPending || updateRole.isPending;
  // Vai trò Quản trị hệ thống là mặc định của hệ thống: chỉ xem, không sửa được
  const isLocked = roleDetail?.code === 'ADMIN';

  if (isEdit && isRoleLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải vai trò...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      {/* Thanh đầu trang: quay lại, tên trang, nút Hủy / Lưu */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-background px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/roles" title="Quay lại danh sách vai trò">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="truncate text-xl font-bold tracking-tight">
            {isLocked ? `Vai trò: ${roleDetail?.name ?? ''}` : isEdit ? `Chỉnh sửa vai trò: ${roleDetail?.name ?? ''}` : 'Tạo vai trò mới'}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" onClick={goBack} disabled={isPending}>
            {isLocked ? 'Quay lại' : 'Hủy'}
          </Button>
          {!isLocked && (
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo vai trò'}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* fieldset disabled khóa toàn bộ ô nhập và ô chọn quyền khi vai trò chỉ để xem */}
        <fieldset disabled={isLocked} className="mx-auto w-full min-w-0 max-w-6xl space-y-6 border-0 p-6">
          {isLocked && (
            <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm font-medium text-primary">
              Đây là vai trò mặc định của hệ thống, chỉ để xem và không chỉnh sửa được.
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          {/* Thông tin vai trò */}
          <section className="rounded-xl border bg-card p-5 shadow-xs">
            <h2 className="mb-4 text-sm font-semibold">Thông tin vai trò</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <p className="text-xs text-muted-foreground">
                  Chữ hoa không dấu, 2-32 ký tự. Không đổi được sau khi tạo.
                </p>
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

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="role_desc">Mô tả nhiệm vụ</Label>
                <Input
                  id="role_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả phạm vi quyền hạn và trách nhiệm của vai trò này"
                  disabled={isPending}
                />
              </div>
            </div>
          </section>

          {/* Ma trận quyền */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold">
                Quyền truy cập{' '}
                <span className="tabular-nums text-muted-foreground">
                  ({selectedPerms.length}/{allPermissions.length} đã chọn)
                </span>
              </h2>
              <div className="relative ml-auto min-w-[240px] flex-1 sm:max-w-sm">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Tìm quyền theo tên hoặc mã..."
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedPerms(grantableCodes(allPermissions))}
              >
                Chọn tất cả
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedPerms([])}>
                Bỏ chọn tất cả
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Object.entries(permissionsByModule).map(([moduleName, perms]) => {
                const selectedCount = perms.filter((p) => selectedPerms.includes(p.code)).length;
                const grantable = grantableCodes(perms);
                const isAllChecked = isLocked
                  ? selectedCount === perms.length
                  : grantable.length > 0 && grantable.every((c) => selectedPerms.includes(c));

                return (
                  <div key={moduleName} className="rounded-xl border bg-card shadow-xs">
                    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <Checkbox checked={isAllChecked} onCheckedChange={() => toggleModuleAll(perms)} />
                        <span className="text-sm font-semibold">{MODULE_LABELS[moduleName] || moduleName}</span>
                      </label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {selectedCount}/{perms.length}
                      </span>
                    </div>

                    <ul className="divide-y">
                      {perms.map((p) => (
                        <li key={p.code}>
                          <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-muted/40">
                            <Checkbox
                              checked={selectedPerms.includes(p.code)}
                              onCheckedChange={() => togglePermission(p.code)}
                              disabled={p.super_admin_only}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ACTION_COLORS[p.action] || 'bg-muted text-muted-foreground'}`}
                                >
                                  {ACTION_LABELS[p.action] || p.action}
                                </span>
                                <span className="text-sm">{p.description}</span>
                                {p.super_admin_only && (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                    Chỉ Quản trị hệ thống
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {Object.keys(permissionsByModule).length === 0 && (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                Không có quyền nào khớp với từ khóa.
              </div>
            )}
          </section>
        </fieldset>
      </div>
    </form>
  );
}
