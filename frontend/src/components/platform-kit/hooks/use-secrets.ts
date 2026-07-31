'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  client,
  unwrapManagementApiResult,
} from '@/components/platform-kit/lib/management-api'
import type { components } from '@/components/platform-kit/lib/management-api-schema'

// GET Secrets
const getSecrets = async (projectRef: string) => {
  const result = await client.GET('/v1/projects/{ref}/secrets', {
    params: {
      path: {
        ref: projectRef,
      },
    },
  })

  return unwrapManagementApiResult(result)
}

export const useGetSecrets = (projectRef: string) => {
  return useQuery({
    queryKey: ['secrets', projectRef],
    queryFn: () => getSecrets(projectRef),
    enabled: !!projectRef,
    retry: false,
  })
}

// CREATE Secrets
const createSecrets = async ({
  projectRef,
  secrets,
}: {
  projectRef: string
  secrets: components['schemas']['CreateSecretBody']
}) => {
  const result = await client.POST('/v1/projects/{ref}/secrets', {
    params: {
      path: {
        ref: projectRef,
      },
    },
    body: secrets,
  })

  return unwrapManagementApiResult(result)
}

export const useCreateSecrets = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSecrets,
    onSuccess: (data, variables) => {
      toast.success(`Secrets created successfully.`)
      queryClient.refetchQueries({
        queryKey: ['secrets', variables.projectRef],
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'There was a problem with your request.')
    },
  })
}

// DELETE Secrets
const deleteSecrets = async ({
  projectRef,
  secretNames,
}: {
  projectRef: string
  secretNames: string[]
}) => {
  const result = await client.DELETE('/v1/projects/{ref}/secrets', {
    params: {
      path: {
        ref: projectRef,
      },
    },
    body: secretNames,
  })

  return unwrapManagementApiResult(result)
}

export const useDeleteSecrets = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSecrets,
    onSuccess: (data, variables) => {
      toast.success(`Secrets deleted successfully.`)
      queryClient.invalidateQueries({
        queryKey: ['secrets', variables.projectRef],
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'There was a problem with your request.')
    },
  })
}
