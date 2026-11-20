import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ImportOutcome } from '@/components/excel-import/types';
import { CreateDriverInput } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function importDrivers(rows: CreateDriverInput[]): Promise<ImportOutcome> {
  const res = await apiClient.post<ImportOutcome>('/master/drivers/import', { rows });
  return res.data;
}

export function useImportDrivers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importDrivers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
    },
  });
}
