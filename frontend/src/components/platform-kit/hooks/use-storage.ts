'use client'

import { useQuery } from '@tanstack/react-query'

import {
  client,
  unwrapManagementApiResult,
} from '@/components/platform-kit/lib/management-api'

// GET Buckets
const getBuckets = async (projectRef: string) => {
  const result = await client.GET('/v1/projects/{ref}/storage/buckets', {
    params: {
      path: {
        ref: projectRef,
      },
    },
  })

  return unwrapManagementApiResult(result)
}

export const useGetBuckets = (projectRef: string) => {
  return useQuery({
    queryKey: ['buckets', projectRef],
    queryFn: () => getBuckets(projectRef),
    enabled: !!projectRef,
    retry: false,
  })
}

/** A storage object as returned by the (not-yet-schema'd) bucket listing endpoint. */
export type StorageObject = Record<string, unknown>

// LIST Objects
const listObjects = async ({
  projectRef,
  bucketId,
}: {
  projectRef: string
  bucketId: string
}): Promise<StorageObject[]> => {
  const result = await client.POST(
    // TODO
    // @ts-expect-error this endpoint is not yet implemented
    '/v1/projects/{ref}/storage/buckets/{bucketId}/objects/list',
    {
      params: {
        path: {
          ref: projectRef,
          bucketId,
        },
      },
      body: {
        path: '',
        options: { limit: 100, offset: 0 },
      },
    }
  )

  return unwrapManagementApiResult(result) as StorageObject[]
}

export const useListObjects = (projectRef: string, bucketId: string) => {
  return useQuery({
    queryKey: ['objects', projectRef, bucketId],
    queryFn: () => listObjects({ projectRef, bucketId }),
    enabled: !!projectRef && !!bucketId,
    retry: false,
  })
}
