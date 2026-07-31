import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'
import { validateEnvVars } from '@/lib/guardrails/env'
import { recordRequestLog } from '@/lib/observability/request-log'

let runtimeEnvValidated = false

function ensureRuntimeEnv() {
  if (runtimeEnvValidated) return
  validateEnvVars('/middleware', [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ], {
    urlVars: ['NEXT_PUBLIC_SUPABASE_URL', 'BACKEND_URL', 'PYTHON_BACKEND_URL'],
  })
  runtimeEnvValidated = true
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const startedAt = Date.now()
  if ((process.env.DB_INCIDENT_MAINTENANCE ?? '').trim().toLowerCase() === 'true') {
    const response = new NextResponse('Alleato PM is temporarily paused while database recovery is in progress.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '300',
      },
    })
    event.waitUntil(recordRequestLog(request, response, startedAt))
    return response
  }

  ensureRuntimeEnv()
  const response = await updateSession(request)
  event.waitUntil(recordRequestLog(request, response, startedAt))
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next (all Next.js internals: static, image, HMR, etc.)
     * - favicon.ico (favicon file)
     * - public folder and static assets
     * - webviewer (PDF.js Express static runtime, including ui/index.html)
     * - monitoring (Sentry tunnel)
     *
     * NOTE: keep this extension list in sync with `shouldBypassSessionMiddleware`
     * in `@/lib/supabase/middleware`. Downloadable public templates (xlsx/xls/csv)
     * MUST be here — otherwise the auth middleware 307-redirects the file request
     * to /auth/login and an `<a download>` click silently downloads nothing.
     */
    '/((?!monitoring|webviewer/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|map|txt|xml|xlsx|xls|csv)$).*)',
  ],
}
