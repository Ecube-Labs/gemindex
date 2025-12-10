import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateStoreRequest } from '@/types/api';

export const storesQueryKey = ['stores'] as const;

export function useStores() {
  return useQuery({
    queryKey: storesQueryKey,
    queryFn: api.listStores,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateStoreRequest) => api.createStore(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storesQueryKey });
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ storeName, force }: { storeName: string; force?: boolean }) =>
      api.deleteStore(storeName, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storesQueryKey });
    },
  });
}
