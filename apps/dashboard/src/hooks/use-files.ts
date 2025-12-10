import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { UploadFileRequest } from '@/types/api';

export const filesQueryKey = (storeName: string) => ['files', storeName] as const;

export function useFiles(storeName: string | null) {
  return useQuery({
    queryKey: filesQueryKey(storeName ?? ''),
    queryFn: () => (storeName ? api.listFiles(storeName) : Promise.resolve([])),
    enabled: !!storeName,
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UploadFileRequest) => {
      const operation = await api.uploadFile(request);
      // Wait for operation to complete
      return api.waitForOperation(operation.name);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: filesQueryKey(variables.storeName) });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ storeName, fileName }: { storeName: string; fileName: string }) =>
      api.deleteFile(storeName, fileName),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: filesQueryKey(variables.storeName) });
    },
  });
}
