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
import {
  HomeIcon,
  Squares2X2Icon,
  Cog6ToothIcon,
  CircleStackIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const pathname = usePathname();

  const navigationItems = [
    {
      title: 'Tổng quan (Dashboard)',
      href: '/',
      icon: HomeIcon,
    },
    {
      title: 'Danh mục mẫu (Sample)',
      href: '/sample',
      icon: Squares2X2Icon,
    },
    {
      title: 'Dữ liệu (Database)',
      href: '/data',
      icon: CircleStackIcon,
    },
    {
      title: 'Cấu hình (Settings)',
      href: '/settings',
      icon: Cog6ToothIcon,
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* Sidebar Header */}
      <SidebarHeader className="h-14 border-b border-border/60 px-4 flex flex-row items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-xs">
          FS
        </div>
        <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Fuel Station
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Admin Base v1.0
          </span>
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Điều hướng chính
          </SidebarGroupLabel>
          <SidebarMenu>
            {navigationItems.map((item) => {
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
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/60 p-3">
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <CommandLineIcon className="h-4 w-4 shrink-0 text-primary" />
          <span>Modular Monolith Base</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
