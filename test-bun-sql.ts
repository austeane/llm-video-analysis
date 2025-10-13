#!/usr/bin/env bun

import { SQL, sql } from 'bun'

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL

if (!databaseUrl) {
  console.error('❌ BETTER_AUTH_DATABASE_URL not set in environment')
  process.exit(1)
}

console.log('🔍 Testing Bun SQL with documented API...')
console.log(`📍 Connecting to: ${databaseUrl.split('@')[1]?.split('?')[0]}`)

// Setup TLS configuration
const caCertPath = process.env.RAILWAY_CA_CERT_PATH
let tlsConfig: any = undefined

if (caCertPath) {
  const caFile = Bun.file(caCertPath)
  if (await caFile.exists()) {
    const caCert = await caFile.text()
    tlsConfig = {
      ca: caCert,
      rejectUnauthorized: true,
    }
    console.log('🔒 TLS enabled with CA certificate verification')
  }
}

try {
  // Test 1: Using the SQL constructor with options
  console.log('\n📝 Test 1: SQL constructor with options object')
  const db = new SQL({
    url: databaseUrl,
    tls: tlsConfig,
    max: 10,
  })

  // According to docs, this should NOT work - SQL object doesn't have query methods
  // The sql tagged template is what provides the query functionality
  console.log('✅ SQL client created')

  // Test 2: Using the sql tagged template (this is the actual query interface)
  console.log('\n📝 Test 2: Using sql tagged template for queries')

  // Set the default connection for sql tagged template
  sql.default = db

  // Now use the sql tagged template for queries
  const version = await sql`SELECT version()`
  console.log('✅ Query executed via sql tagged template!')
  console.log(`📊 Database version: ${version[0].version.split(',')[0]}`)

  // Test 3: Check for Better Auth tables
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name LIKE '%user%' OR table_name LIKE '%session%' OR table_name LIKE '%auth%')
    ORDER BY table_name
  `

  console.log('\n📋 Auth-related tables found:')
  if (tables.length === 0) {
    console.log('  ⚠️  No auth tables found')
  } else {
    tables.forEach((table: any) => {
      console.log(`  • ${table.table_name}`)
    })
  }

  // Test 4: Array helpers
  console.log('\n📝 Test 4: SQL array helpers')
  const arrayTest =
    await sql`SELECT ${sql.array([1, 2, 3], 'INTEGER')} as numbers`
  console.log('✅ Array helper works:', arrayTest[0].numbers)

  console.log('\n✨ All tests successful!')
} catch (error) {
  console.error('❌ Test failed:', error)
  process.exit(1)
}
