import { Kysely, PostgresDialect } from 'kysely'
import type { ColumnType, Generated } from 'kysely'

import { authDbPool } from '@/lib/auth'

export interface BillingUsageLedgerTable {
  id: Generated<number>
  request_id: string
  user_id: string | null
  session_id: string | null
  model: string
  prompt_token_count: number | null
  candidates_token_count: number | null
  total_token_count: number | null
  cached_content_token_count: number | null
  input_cost_usd: number
  output_cost_usd: number
  cost_usd: number
  currency: string
  youtube_url: string | null
  created_at: ColumnType<Date, Date | string | undefined, never>
}

export interface Database {
  billing_usage_ledger: BillingUsageLedgerTable
}

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: authDbPool,
  }),
})
