import createClient from 'openapi-fetch'

import type { paths } from './management-api-schema'

export const client = createClient<paths>({
  baseUrl: '/api/supabase-proxy',
})

/** A Supabase Management API request that came back non-2xx, with the upstream detail intact. */
export class ManagementApiError extends Error {
  readonly status: number
  readonly statusText: string
  /** The parsed upstream error body, when the failed response had one. */
  readonly body: unknown

  constructor(status: number, statusText: string, body: unknown) {
    super(buildMessage(status, statusText, body))
    this.name = 'ManagementApiError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

/** Pull the human-readable message out of Supabase's error body shapes. */
function extractUpstreamMessage(body: unknown): string | undefined {
  if (typeof body === 'string') {
    return body.trim() || undefined
  }
  if (body && typeof body === 'object') {
    const candidate = body as { message?: unknown; error?: unknown; msg?: unknown }
    for (const value of [candidate.message, candidate.error, candidate.msg]) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }
  return undefined
}

function buildMessage(status: number, statusText: string, body: unknown): string {
  const upstream =
    extractUpstreamMessage(body) ??
    `The Supabase Management API rejected the request${statusText ? ` (${statusText})` : ''}.`
  const hint =
    status === 401 || status === 403
      ? ' Check that SUPABASE_MANAGEMENT_API_TOKEN belongs to an account with access to this project.'
      : ''
  return `${upstream} (HTTP ${status})${hint}`
}

type ManagementApiResult<TData> = {
  data?: TData
  error?: unknown
  response: Pick<Response, 'ok' | 'status' | 'statusText'>
}

/**
 * Return the data from an openapi-fetch result, or throw a `ManagementApiError`.
 *
 * openapi-fetch resolves for BOTH outcomes — it never throws on a non-2xx — and
 * reports failures in two different shapes:
 *   - non-2xx with a body  -> `{ error: <parsed body>, response }`
 *   - non-2xx with NO body -> `{ error: undefined, response }` (204 / HEAD /
 *     `Content-Length: 0`)
 *
 * So `if (error) throw error` resolves the second shape to `data: undefined`
 * with no signal at all, which every panel then renders as "you have nothing
 * here" rather than "this request failed". Gate on `response.ok` — never on
 * `error` alone — so a failure can never reach the UI disguised as empty data.
 */
export function unwrapManagementApiResult<TData>(result: ManagementApiResult<TData>): TData {
  const { data, error, response } = result

  if (!response?.ok) {
    throw new ManagementApiError(response?.status ?? 0, response?.statusText ?? '', error)
  }
  if (error !== undefined) {
    throw new ManagementApiError(response.status, response.statusText, error)
  }

  return data as TData
}
