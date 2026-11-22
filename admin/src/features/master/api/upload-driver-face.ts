import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CredentialItem } from '../types';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

export async function uploadDriverFace({ id, file }: { id: string; file: File }): Promise<CredentialItem> {
  const formData = new FormData();
  formData.append('photo', file);

  const res = await apiClient.post<CredentialItem>(`/master/drivers/${id}/credentials/face`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export function useUploadDriverFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDriverFace,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      queryClient.invalidateQueries({ queryKey: masterKeys.driverDetail(vars.id) });
      toast.success('Cập nhật dữ liệu nhận diện khuôn mặt thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể tải ảnh khuôn mặt');
    },
  });
}
