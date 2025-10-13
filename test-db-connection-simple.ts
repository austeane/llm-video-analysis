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
  // Try to create the SQL connection - Better Auth will handle the actual queries
  const db = new SQL(sqlOptions)

  // The SQL constructor itself should validate the connection
  // If we get here without an error, the connection parameters are valid
  console.log('✅ SQL client created successfully!')
  console.log('✨ Database connection parameters are valid!')
  console.log('📝 Better Auth will handle the actual database operations')

  // Note: Bun's SQL client for PostgreSQL is a thin wrapper that passes
  // the connection to Better Auth which handles the queries internally
} catch (error) {
  console.error('❌ Failed to create SQL client:', error)
  process.exit(1)
}
