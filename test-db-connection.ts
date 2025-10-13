#!/usr/bin/env bun

import { SQL } from 'bun'

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL

if (!databaseUrl) {
  console.error('❌ BETTER_AUTH_DATABASE_URL not set in environment')
  process.exit(1)
}

console.log('🔍 Testing PostgreSQL connection...')
console.log(`📍 Connecting to: ${databaseUrl.split('@')[1]?.split('?')[0]}`)

// Setup TLS configuration
const sqlOptions: SQL.Options = { url: databaseUrl }
const caCertPath = process.env.RAILWAY_CA_CERT_PATH
const requiresTls = /sslmode=require/i.test(databaseUrl)

if (caCertPath) {
  const caFile = Bun.file(caCertPath)
  if (await caFile.exists()) {
    const caCert = await caFile.text()
    sqlOptions.tls = {
      ca: caCert,
      rejectUnauthorized: true,
    }
    console.log('🔒 TLS enabled with CA certificate verification')
  } else {
    console.warn(
      `⚠️  RAILWAY_CA_CERT_PATH="${caCertPath}" not found; falling back to insecure TLS`,
    )
    sqlOptions.tls = { rejectUnauthorized: false }
  }
} else if (requiresTls) {
  console.warn(
    '⚠️  sslmode=require detected but RAILWAY_CA_CERT_PATH not set; using insecure TLS',
  )
  sqlOptions.tls = { rejectUnauthorized: false }
}

try {
  const db = new SQL(sqlOptions)

  // Test basic connection using Bun SQL's query method
  const result = await db.query('SELECT version()').then((r) => r.rows)
  console.log('✅ Connected to PostgreSQL!')
  console.log(`📊 Database version: ${result[0].version.split(',')[0]}`)

  // Check for Better Auth tables
  const tables = await db
    .query(
      `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name LIKE '%user%' OR table_name LIKE '%session%' OR table_name LIKE '%auth%')
    ORDER BY table_name;
  `,
    )
    .then((r) => r.rows)

  console.log('\n📋 Auth-related tables found:')
  if (tables.length === 0) {
    console.log(
      '  ⚠️  No auth tables found. Better Auth may need to initialize them on first run.',
    )
  } else {
    tables.forEach((table: any) => {
      console.log(`  • ${table.table_name}`)
    })
  }

  db.close()
  console.log('\n✨ Database connection test successful!')
} catch (error) {
  console.error('❌ Database connection failed:', error)
  process.exit(1)
}
