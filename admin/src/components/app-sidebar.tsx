'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import {
  HomeIcon,
  CircleStackIcon,
  TruckIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  DocumentArrowDownIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  SignalIcon,
  ShieldCheckIcon,
  BuildingOffice2Icon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/hooks/use-auth';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  roles?: ('MANAGER' | 'ACCOUNTANT' | 'IT')[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, role, hasPermission, logout, isLoggingOut } = useAuth();

  const navigationGroups: NavGroup[] = [
    {
      label: 'Tổng quan',
      items: [
        {
          title: 'Dashboard',
          href: '/',
          icon: HomeIcon,
          permission: 'dashboard:view',
        },
      ],
    },
    {
      label: 'Vận hành & Cột bơm',
      items: [
        {
          title: 'Bể chứa nhiên liệu',
          href: '/tanks',
          icon: CircleStackIcon,
          permission: 'asset.tank:view',
        },
        {
          title: 'Trụ bơm',
          href: '/pumps',
          icon: AdjustmentsHorizontalIcon,
          permission: 'asset.pump:view',
        },
        {
          title: 'Phiên đổ & Cấp phát',
          href: '/dispense-sessions',
          icon: ClockIcon,
          permission: 'dispense.session:view',
        },
      ],
    },
    {
      label: 'Phương tiện & Tài xế',
      items: [
        {
          title: 'Danh mục Xe',
          href: '/vehicles',
          icon: TruckIcon,
          permission: 'master.vehicle:view',
        },
        {
          title: 'Tài xế & Nhận diện',
          href: '/drivers',
          icon: UserGroupIcon,
          permission: 'master.driver:view',
        },
        {
          title: 'Định mức nhiên liệu',
          href: '/quotas',
          icon: ChartBarIcon,
          permission: 'master.quota:view',
        },
      ],
    },
    {
      label: 'Kho & Kiểm kê',
      items: [
        {
          title: 'Phiếu nhập bể',
          href: '/inventory/receipts',
          icon: DocumentArrowDownIcon,
          permission: 'inventory.receipt:view',
        },
        {
          title: 'Phiếu xuất điều chỉnh',
          href: '/inventory/issues',
          icon: AdjustmentsHorizontalIcon,
          permission: 'inventory.issue:view',
        },
        {
          title: 'Kiểm kê & Đối chiếu',
          href: '/inventory/stocktake',
          icon: ClipboardDocumentCheckIcon,
          permission: 'inventory.stocktake:view',
        },
      ],
    },
    {
      label: 'Báo cáo',
      items: [
        {
          title: 'Báo cáo Nhập - Xuất - Tồn',
          href: '/reports',
          icon: ChartBarIcon,
          permission: 'report:view',
        },
      ],
    },
    {
      label: 'Giám sát & Quản trị',
      items: [
        {
          title: 'Trạng thái trạm & Đồng bộ',
          href: '/sync-monitor',
          icon: SignalIcon,
          permission: 'sync.monitor:view',
        },
        {
          title: 'Nhật ký thao tác (Audit)',
          href: '/audit-logs',
          icon: ShieldCheckIcon,
          permission: 'audit.log:view',
        },
        {
          title: 'Nhà máy & Chi nhánh',
          href: '/branches',
          icon: BuildingOffice2Icon,
          permission: 'org.branch:view',
        },
        {
          title: 'Tài khoản người dùng',
          href: '/users',
          icon: UserCircleIcon,
          permission: 'iam.user:view',
        },
        {
          title: 'Vai trò & Phân quyền',
          href: '/roles',
          icon: ShieldCheckIcon,
          permission: 'iam.role:view',
        },
      ],
    },
  ];

  const roleLabelMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    MANAGER: { label: 'Quản lý', variant: 'default' },
    ACCOUNTANT: { label: 'Kế toán', variant: 'secondary' },
    IT: { label: 'IT Kỹ thuật', variant: 'outline' },
  };

  const currentRoleInfo = roleLabelMap[role] || { label: 'Quản lý', variant: 'default' };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* Sidebar Header */}
      <SidebarHeader className="h-14 border-b border-border/60 px-4 flex flex-row items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-xs">
          FS
        </div>
        <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Fuel Station System
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Quản trị Vận hành Trạm
          </span>
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent>
        {navigationGroups.map((group) => {
          // Filter items based on permissions
          const visibleItems = group.items.filter((item) => {
            if (!item.permission) return true;
            return hasPermission(item.permission);
          });

          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname?.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          'transition-colors',
                          isActive && 'bg-primary/10 text-primary font-medium'
                        )}
                      >
                        <Link href={item.href}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer with User info & Logout */}
      <SidebarFooter className="border-t border-border/60 p-3">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2.5 truncate group-data-[collapsible=icon]:hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs text-foreground">
              {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-medium text-foreground truncate">
                {user?.fullName || 'Người dùng'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={currentRoleInfo.variant} className="text-[10px] px-1.5 py-0 h-4">
                  {currentRoleInfo.label}
                </Badge>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            disabled={isLoggingOut}
            title="Đăng xuất"
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span className="sr-only">Đăng xuất</span>
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
