#!/usr/bin/env bun
import { getMigrations } from 'better-auth/db'
import { auth } from '../src/lib/auth.ts'

async function main() {
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
  console.log('✅ Better Auth migrations executed successfully')
}

main().catch((error) => {
  console.error('❌ Failed to run Better Auth migrations', error)
  process.exit(1)
})
