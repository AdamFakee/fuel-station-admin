'use client';

import * as React from 'react';
import Paginator from '@/components/paginator';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PlusIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { QuotaRule } from '@/features/quota/types';
import { useQuotaRules } from '@/features/quota/api/get-quota-rules';
import { useQuotaExtras } from '@/features/quota/api/get-quota-extras';
import { QuotaRuleTable } from '@/features/quota/components/quota-rule-table';
import { QuotaRuleDialog } from '@/features/quota/components/quota-rule-dialog';
import { QuotaExtraTable } from '@/features/quota/components/quota-extra-table';
import { QuotaExtraDialog } from '@/features/quota/components/quota-extra-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function QuotasPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master.quota:create');

  const [activeTab, setActiveTab] = React.useState('rules');

  // Filter states for rules
  const [statusFilter, setStatusFilter] = React.useState<string>('active');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [rulePage, setRulePage] = React.useState(1);
  const [rulePageSize, setRulePageSize] = React.useState(15);
  const [extraPage, setExtraPage] = React.useState(1);
  const [extraPageSize, setExtraPageSize] = React.useState(15);

  React.useEffect(() => {
    setRulePage(1);
  }, [statusFilter, searchQuery]);

  // Dialog states
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<QuotaRule | null>(null);
  const [extraDialogOpen, setExtraDialogOpen] = React.useState(false);

  // Queries
  const { data: rulesData, isLoading: isRulesLoading } = useQuotaRules({
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: searchQuery || undefined,
    page: rulePage,
    page_size: rulePageSize,
  });

  const { data: extrasData, isLoading: isExtrasLoading } = useQuotaExtras({
    page: extraPage,
    page_size: extraPageSize,
  });

  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  };

  const handleOpenEditRule = (rule: QuotaRule) => {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <DetailPageHeader
        title="Quản lý Định mức Nhiên liệu"
      >
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExtraDialogOpen(true)}
              >
                <SparklesIcon className="mr-1.5 h-4 w-4 text-primary" />
                Cấp bổ sung đột xuất
              </Button>
              <Button size="sm" onClick={handleOpenCreateRule}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Thêm quy tắc định mức
              </Button>
            </>
          )}
        </div>
      </DetailPageHeader>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="rules" className="text-xs font-medium">
            Quy tắc định mức ({rulesData?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="extras" className="text-xs font-medium">
            Cấp bổ sung đột xuất ({extrasData?.total ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Quy tắc định mức */}
        <TabsContent value="rules" className="flex min-h-0 flex-1 flex-col gap-4 data-[state=inactive]:hidden">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm mã định mức, biển số xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="active">Đang hiệu lực</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <QuotaRuleTable
            rules={rulesData?.data || []}
            onEdit={handleOpenEditRule}
            isLoading={isRulesLoading}
          />
          <Paginator
            currentPage={rulePage}
            pageSize={rulePageSize}
            totalItems={rulesData?.total ?? 0}
            onPageChange={(p, size) => {
              setRulePage(p);
              setRulePageSize(size);
            }}
          />
        </TabsContent>

        {/* Tab 2: Cấp bổ sung đột xuất */}
        <TabsContent value="extras" className="flex min-h-0 flex-1 flex-col gap-4 data-[state=inactive]:hidden">
          <QuotaExtraTable
            extras={extrasData?.data || []}
            isLoading={isExtrasLoading}
          />
          <Paginator
            currentPage={extraPage}
            pageSize={extraPageSize}
            totalItems={extrasData?.total ?? 0}
            onPageChange={(p, size) => {
              setExtraPage(p);
              setExtraPageSize(size);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <QuotaRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        editingRule={editingRule}
      />

      <QuotaExtraDialog
        open={extraDialogOpen}
        onOpenChange={setExtraDialogOpen}
      />
    </div>
  );
}
