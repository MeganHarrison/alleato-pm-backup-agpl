'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  client,
  unwrapManagementApiResult,
} from '@/components/platform-kit/lib/management-api'

/**
 * One row of a `/database/query` result. The Management API schema types the
 * response as an opaque record, so rows are column-name keyed with unknown
 * values — consumers narrow per column.
 */
export type QueryResultRow = Record<string, unknown>

// RUN SQL Query
export const runQuery = async ({
  projectRef,
  query,
  readOnly,
}: {
  projectRef: string
  query: string
  readOnly?: boolean
}): Promise<QueryResultRow[]> => {
  const result = await client.POST('/v1/projects/{ref}/database/query', {
    params: {
      path: {
        ref: projectRef,
      },
    },
    body: {
      query,
      read_only: readOnly,
    },
  })

  return unwrapManagementApiResult(result) as QueryResultRow[]
}

export const useRunQuery = () => {
  return useMutation({
    mutationFn: runQuery,
    onError: (error: Error) => {
      toast.error(error.message || 'There was a problem with your query.')
    },
  })
}
