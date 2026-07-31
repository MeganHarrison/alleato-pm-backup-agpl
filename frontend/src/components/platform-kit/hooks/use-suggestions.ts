'use client'

import { useQuery } from '@tanstack/react-query'

import {
  client,
  unwrapManagementApiResult,
} from '@/components/platform-kit/lib/management-api'

// GET Suggestions
const getSuggestions = async (projectRef: string) => {
  const [performanceResult, securityResult] = await Promise.all([
    client.GET('/v1/projects/{ref}/advisors/performance', {
      params: {
        path: {
          ref: projectRef,
        },
      },
    }),
    client.GET('/v1/projects/{ref}/advisors/security', {
      params: {
        path: {
          ref: projectRef,
        },
      },
    }),
  ])
  const performanceData = unwrapManagementApiResult(performanceResult)
  const securityData = unwrapManagementApiResult(securityResult)

  // Add type to each suggestion
  const performanceLints = (performanceData?.lints || []).map((lint) => ({
    ...lint,
    type: 'performance' as const,
  }))
  const securityLints = (securityData?.lints || []).map((lint) => ({
    ...lint,
    type: 'security' as const,
  }))
  return [...performanceLints, ...securityLints]
}

export const useGetSuggestions = (projectRef: string) => {
  return useQuery({
    queryKey: ['suggestions', projectRef],
    queryFn: () => getSuggestions(projectRef),
    enabled: !!projectRef,
    retry: false,
  })
}
