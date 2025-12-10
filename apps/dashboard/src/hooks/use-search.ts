import { useMutation } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { SearchRequest } from '@/types/api';

export function useSearch() {
  return useMutation({
    mutationFn: (request: SearchRequest) => api.search(request),
  });
}
