import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import createClient from 'openapi-fetch'

import type { paths } from '@/components/platform-kit/lib/management-api-schema'
import { listTablesSql } from '@/components/platform-kit/lib/pg-meta'
import { createClient as createSupabaseServerClient, getApiRouteUser } from '@/lib/supabase/server'

/**
 * Admin gate for the Platform Kit. The Management API token grants full control
 * of the Supabase project, so every entry point must verify the caller is an
 * Alleato admin (mirrors the /api/supabase-proxy guard). Returns a NextResponse
 * on failure, or null when the caller is an authorized admin.
 */
async function requirePlatformKitAdmin() {
  const supabase = await createSupabaseServerClient()
  const user = await getApiRouteUser()
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return NextResponse.json(
      { message: 'Admin access required for the Supabase management console.' },
      { status: 403 }
    )
  }
  return null
}

// Lazy singletons — never initialize server clients at module scope, or they
// read env during `next build` (when the vars are absent) and crash the build.
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

let _client: ReturnType<typeof createClient<paths>> | null = null
function getClient() {
  if (!_client) {
    _client = createClient<paths>({
      baseUrl: 'https://api.supabase.com',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_MANAGEMENT_API_TOKEN}`,
      },
    })
  }
  return _client
}

type SchemaColumn = { name: string; data_type: string }
type SchemaTable = { name: string; columns: SchemaColumn[] }

// Function to get database schema
async function getDbSchema(projectRef: string): Promise<SchemaTable[]> {
  const token = process.env.SUPABASE_MANAGEMENT_API_TOKEN
  if (!token) {
    throw new Error('Supabase Management API token is not configured.')
  }

  const sql = listTablesSql()

  const { data, error } = await getClient().POST('/v1/projects/{ref}/database/query', {
    params: {
      path: {
        ref: projectRef,
      },
    },
    body: {
      query: sql,
      read_only: true,
    },
  })

  if (error) {
    throw error
  }

  return (data as unknown as SchemaTable[]) ?? []
}

function formatSchemaForPrompt(schema: SchemaTable[]) {
  let schemaString = ''
  if (Array.isArray(schema)) {
    schema.forEach((table) => {
      const columnInfo = table.columns.map((c) => `${c.name} (${c.data_type})`)
      schemaString += `Table "${table.name}" has columns: ${columnInfo.join(', ')}.\n`
    })
  }
  return schemaString
}

export async function POST(request: Request) {
  try {
    const denied = await requirePlatformKitAdmin()
    if (denied) return denied

    const { prompt, projectRef } = await request.json()

    if (!prompt) {
      return NextResponse.json({ message: 'Prompt is required.' }, { status: 400 })
    }
    if (!projectRef) {
      return NextResponse.json({ message: 'projectRef is required.' }, { status: 400 })
    }

    // 1. Get database schema
    const schema = await getDbSchema(projectRef)
    const formattedSchema = formatSchemaForPrompt(schema)

    // 2. Create a prompt for OpenAI
    const systemPrompt = `You are an expert SQL assistant. Given the following database schema, write a SQL query that answers the user's question. Return only the SQL query, do not include any explanations or markdown.\n\nSchema:\n${formattedSchema}`

    // 3. Call OpenAI to generate SQL using responses.create (plain text output)
    const response = await getOpenAI().responses.create({
      model: 'gpt-4.1',
      instructions: systemPrompt, // Use systemPrompt as instructions
      input: prompt, // User's question
    })

    const sql = response.output_text

    if (!sql) {
      return NextResponse.json(
        { message: 'Could not generate SQL from the prompt.' },
        { status: 500 }
      )
    }

    // 4. Return the generated SQL
    return NextResponse.json({ sql })
  } catch (error: unknown) {
    console.error('AI SQL generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.'
    const status =
      typeof error === 'object' && error !== null && 'response' in error
        ? ((error as { response?: { status?: number } }).response?.status ?? 500)
        : 500
    return NextResponse.json({ message: errorMessage }, { status })
  }
}
