'use client'

import { useQuery } from '@tanstack/react-query'

import { runQuery } from '@/components/platform-kit/hooks/use-run-query'
import { listTablesSql } from '@/components/platform-kit/lib/pg-meta'

// LIST Tables
const listTables = ({ projectRef, schemas }: { projectRef: string; schemas?: string[] }) => {
  const sql = listTablesSql(schemas)
  return runQuery({
    projectRef,
    query: sql,
    readOnly: true,
  })
}

export const useListTables = (projectRef: string, schemas?: string[]) => {
  return useQuery({
    queryKey: ['tables', projectRef, schemas],
    queryFn: () => listTables({ projectRef, schemas }),
    enabled: !!projectRef,
    // Match every other panel hook: an auth/permission failure is not worth
    // three invisible retries — surface it immediately instead of holding the
    // skeleton for ~7s and then rendering an error.
    retry: false,
  })
}
