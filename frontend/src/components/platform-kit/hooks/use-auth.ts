'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  client,
  unwrapManagementApiResult,
} from '@/components/platform-kit/lib/management-api'
import type { components } from '@/components/platform-kit/lib/management-api-schema'

const getAuthConfig = async (projectRef: string) => {
  const result = await client.GET('/v1/projects/{ref}/config/auth', {
    params: {
      path: { ref: projectRef },
    },
  })

  return unwrapManagementApiResult(result)
}

export const useGetAuthConfig = (projectRef: string) => {
  return useQuery({
    queryKey: ['auth-config', projectRef],
    queryFn: () => getAuthConfig(projectRef),
    enabled: !!projectRef,
    retry: false,
  })
}

// UPDATE Auth Config
const updateAuthConfig = async ({
  projectRef,
  payload,
}: {
  projectRef: string
  payload: components['schemas']['UpdateAuthConfigBody']
}) => {
  const result = await client.PATCH('/v1/projects/{ref}/config/auth', {
    params: {
      path: {
        ref: projectRef,
      },
    },
    body: payload,
  })

  return unwrapManagementApiResult(result)
}

export const useUpdateAuthConfig = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateAuthConfig,
    onSuccess: (data, variables) => {
      toast.success(`Auth config updated.`)
      queryClient.invalidateQueries({
        queryKey: ['auth-config', variables.projectRef],
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'There was a problem with your request.')
    },
  })
}
