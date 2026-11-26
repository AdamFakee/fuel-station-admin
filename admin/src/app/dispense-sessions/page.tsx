'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Paginator from '@/components/paginator';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { CircleCheckBigIcon, CircleXIcon, ClipboardListIcon, DropletsIcon, ShieldBanIcon } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { formatNumberVN } from '@/lib/format';
import { useBranches } from '@/features/iam/api/get-branches';
import { useSessions } from '@/features/dispense/api/get-sessions';
import { useAccessEvents } from '@/features/dispense/api/get-access-events';
import { useDispenseSummary } from '@/features/dispense/api/get-dispense-summary';
import { SessionTable } from '@/features/dispense/components/session-table';
import { SessionDetailDialog } from '@/features/dispense/components/session-detail-dialog';
import { AccessEventTable } from '@/features/dispense/components/access-event-table';

export default function DispenseSessionsPage() {
  const { data: rawBranches = [] } = useBranches();
  const branches: any[] = Array.isArray(rawBranches) ? rawBranches : ((rawBranches as any)?.items || (rawBranches as any)?.data || []);

  // Tab state
  const [activeTab, setActiveTab] = React.useState('sessions');

  // Filter states
  const [branchId, setBranchId] = React.useState<string>('all');
  const [status, setStatus] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sessionPage, setSessionPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  // Access Events filter states
  const [decision, setDecision] = React.useState<string>('reject'); // Default show rejects
  const [method, setMethod] = React.useState<string>('all');
  const [accessPage, setAccessPage] = React.useState(1);

  // Detail dialog
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setSessionPage(1);
      setAccessPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Queries
  const {
    data: sessionsData,
    isLoading: isSessionsLoading,
  } = useSessions({
    page: sessionPage,
    page_size: pageSize,
    branch_id: branchId !== 'all' ? branchId : undefined,
    status: status !== 'all' ? status : undefined,
    q: debouncedSearch || undefined,
  });

  const {
    data: accessEventsData,
    isLoading: isAccessLoading,
  } = useAccessEvents({
    page: accessPage,
    page_size: pageSize,
    branch_id: branchId !== 'all' ? branchId : undefined,
    decision: decision !== 'all' ? decision : undefined,
    method: method !== 'all' ? method : undefined,
    q: debouncedSearch || undefined,
  });

  const { data: summary } = useDispenseSummary(
    branchId !== 'all' ? branchId : undefined
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        {/* Thẻ số liệu tổng quan */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Tổng phiên" value={summary ? formatNumberVN(summary.total_sessions) : '—'} icon={ClipboardListIcon} tone="primary" />
          <StatCard label="Hoàn thành" value={summary ? formatNumberVN(summary.completed_sessions) : '—'} icon={CircleCheckBigIcon} tone="success" />
          <StatCard
            label="Đã hủy / lỗi"
            value={summary ? formatNumberVN(summary.cancelled_sessions + summary.failed_sessions) : '—'}
            icon={CircleXIcon}
            tone="neutral"
          />
          <StatCard
            label="Tổng lít cấp"
            value={summary ? `${formatNumberVN(summary.total_dispensed_liters, 2)} L` : '—'}
            icon={DropletsIcon}
            tone="primary"
          />
          <StatCard label="Bị từ chối" value={summary ? formatNumberVN(summary.rejected_auth_count) : '—'} icon={ShieldBanIcon} tone="danger" />
        </div>

        {/* Main Tabs Container */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-4">
          <TabsList>
            <TabsTrigger value="sessions">
              Danh sách phiên đổ
            </TabsTrigger>
            <TabsTrigger value="access">
              Lượt bị từ chối & xác thực
            </TabsTrigger>
          </TabsList>

          {/* Thanh tìm kiếm và bộ lọc, cùng kiểu với các trang danh sách khác */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    activeTab === 'sessions'
                      ? 'Tìm biển số, tài xế, mã...'
                      : 'Tìm mã thẻ, người quẹt...'
                  }
                  className="pl-9"
                />
              </div>

              <Select
                value={branchId}
                onValueChange={(val) => {
                  setBranchId(val);
                  setSessionPage(1);
                  setAccessPage(1);
                }}
              >
                <SelectTrigger className="w-full lg:w-[220px]">
                  <SelectValue placeholder="Trạm xăng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạm xăng</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeTab === 'sessions' ? (
                <Select
                  value={status}
                  onValueChange={(val) => {
                    setStatus(val);
                    setSessionPage(1);
                  }}
                >
                  <SelectTrigger className="w-full lg:w-[190px]">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    <SelectItem value="completed">Hoàn thành</SelectItem>
                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                    <SelectItem value="failed">Lỗi bơm</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Select
                    value={decision}
                    onValueChange={(val) => {
                      setDecision(val);
                      setAccessPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full lg:w-[190px]">
                      <SelectValue placeholder="Kết quả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả kết quả</SelectItem>
                      <SelectItem value="reject">Bị từ chối</SelectItem>
                      <SelectItem value="accept">Hợp lệ</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={method}
                    onValueChange={(val) => {
                      setMethod(val);
                      setAccessPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full lg:w-[190px]">
                      <SelectValue placeholder="Phương thức" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="card">Thẻ NFC</SelectItem>
                      <SelectItem value="face">Khuôn mặt</SelectItem>                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>

          {/* Tab 1: Sessions */}
          <TabsContent value="sessions" className="flex min-h-0 flex-1 flex-col gap-4 data-[state=inactive]:hidden">
            <SessionTable
              sessions={sessionsData?.items || []}
              isLoading={isSessionsLoading}
              onViewDetail={(s) => setSelectedSessionId(s.id)}
            />

            {sessionsData && (
          <Paginator
            currentPage={sessionPage}
            pageSize={pageSize}
            totalItems={sessionsData.total}
            onPageChange={(p, size) => {
              setSessionPage(p);
              setPageSize(size);
            }}
          />
        )}
          </TabsContent>

          {/* Tab 2: Access Events */}
          <TabsContent value="access" className="flex min-h-0 flex-1 flex-col gap-4 data-[state=inactive]:hidden">
            <AccessEventTable
              events={accessEventsData?.items || []}
              isLoading={isAccessLoading}
            />

            {accessEventsData && (
          <Paginator
            currentPage={accessPage}
            pageSize={pageSize}
            totalItems={accessEventsData.total}
            onPageChange={(p, size) => {
              setAccessPage(p);
              setPageSize(size);
            }}
          />
        )}
          </TabsContent>
        </Tabs>

        {/* Session Detail Dialog */}
        <SessionDetailDialog
          open={Boolean(selectedSessionId)}
          onOpenChange={(open) => !open && setSelectedSessionId(null)}
          sessionId={selectedSessionId}
        />
      </div>
  );
}
