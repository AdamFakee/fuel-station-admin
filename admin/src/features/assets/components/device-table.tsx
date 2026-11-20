'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { DeviceView } from '../types';
import { useDevices } from '../api/get-devices';
import { useBranches } from '../api/get-branches';
import { DeviceSensorDialog } from './device-sensor-dialog';
import { DeviceTerminalDialog } from './device-terminal-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function DeviceTable() {
  const { isManager } = useAuth();
  const [branchFilter, setBranchFilter] = React.useState('');
  const [selectedDevice, setSelectedDevice] = React.useState<DeviceView | null>(null);
  const [sensorDialogOpen, setSensorDialogOpen] = React.useState(false);
  const [terminalDialogOpen, setTerminalDialogOpen] = React.useState(false);

  const { data: branchData } = useBranches();
  const { data: devices, isLoading } = useDevices(branchFilter || undefined);

  const branches = branchData?.data || [];

  const handleEditSensor = (device: DeviceView) => {
    setSelectedDevice(device);
    setSensorDialogOpen(true);
  };

  const handleEditTerminal = (device: DeviceView) => {
    setSelectedDevice(device);
    setTerminalDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">-- Tất cả chi nhánh --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px] text-left">Trụ bơm</TableHead>
              <TableHead className="text-left">Chi nhánh</TableHead>
              <TableHead className="text-left">Cổng COM (RS-485)</TableHead>
              <TableHead className="text-right tabular-nums">Serial Bộ số</TableHead>
              <TableHead className="text-right tabular-nums">Baud Rate</TableHead>
              <TableHead className="text-left">Máy chấm công (Host)</TableHead>
              <TableHead className="text-right tabular-nums">Port</TableHead>
              <TableHead className="text-center w-[120px]">Bảo mật Mật khẩu</TableHead>
              {isManager && <TableHead className="text-right w-[140px]">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isManager ? 9 : 8} className="h-24 text-center text-muted-foreground text-xs">
                  Đang tải danh sách thiết bị ngoại vi...
                </TableCell>
              </TableRow>
            ) : !devices || devices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 9 : 8} className="h-24 text-center text-muted-foreground text-xs">
                  Chưa có thiết bị nào được gắn với trụ bơm.
                </TableCell>
              </TableRow>
            ) : (
              devices.map((d) => (
                <TableRow key={d.pump_id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs font-medium text-left">
                    <div>{d.pump_code}</div>
                    <div className="text-[11px] text-muted-foreground font-normal">{d.pump_name}</div>
                  </TableCell>
                  <TableCell className="text-left text-xs text-muted-foreground">{d.branch_name}</TableCell>
                  <TableCell className="text-left font-mono text-xs font-medium">
                    {d.sensor?.com_port || '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-mono">
                    {d.sensor?.serial ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-mono">
                    {d.sensor?.baud ?? '—'}
                  </TableCell>
                  <TableCell className="text-left font-mono text-xs">
                    {d.terminal ? `${d.terminal.host} (${d.terminal.terminal_code})` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-mono">
                    {d.terminal?.port ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-700 border-green-300">
                      AES-GCM
                    </Badge>
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSensor(d)}
                          className="h-7 text-xs px-2 gap-1"
                        >
                          <PencilSquareIcon className="h-3 w-3" />
                          <span>Bộ số</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTerminal(d)}
                          className="h-7 text-xs px-2 gap-1"
                        >
                          <PencilSquareIcon className="h-3 w-3" />
                          <span>MCC</span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DeviceSensorDialog open={sensorDialogOpen} onOpenChange={setSensorDialogOpen} device={selectedDevice} />
      <DeviceTerminalDialog open={terminalDialogOpen} onOpenChange={setTerminalDialogOpen} device={selectedDevice} />
    </div>
  );
}
