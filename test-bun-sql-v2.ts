#!/usr/bin/env bun

import { SQL } from 'bun'

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL

if (!databaseUrl) {
  console.error('❌ BETTER_AUTH_DATABASE_URL not set in environment')
  process.exit(1)
}

console.log('🔍 Testing Bun SQL Direct Query API...')
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
  // Create SQL connection with 'await using' for proper cleanup
  await using db = new SQL({
    url: databaseUrl,
    tls: tlsConfig,
    max: 1, // Single connection for testing
  })

  console.log('✅ SQL client created')

  // According to Bun 1.3 docs, the SQL instance should have query capabilities
  // Let's try the documented query patterns

  // Test 1: Direct query using the connection's sql template
  console.log('\n📝 Test 1: Direct query using db connection')
  const versionResult = await db`SELECT version()`
  console.log('✅ Direct query succeeded!')
  console.log(`📊 Database version: ${versionResult[0].version.split(',')[0]}`)

  // Test 2: Query with parameters
  console.log('\n📝 Test 2: Query with parameters')
  const testValue = 1
  const paramResult = await db`SELECT ${testValue} as test_value`
  console.log('✅ Parameterized query succeeded:', paramResult[0])

  // Test 3: Check for Better Auth tables
  console.log('\n📝 Test 3: Checking Better Auth tables')
  const tables = await db`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name LIKE '%user%' OR table_name LIKE '%session%' OR table_name LIKE '%auth%')
    ORDER BY table_name
  `

  console.log('📋 Auth-related tables found:')
  if (tables.length === 0) {
    console.log('  ⚠️  No auth tables found')
  } else {
    tables.forEach((table: any) => {
      console.log(`  • ${table.table_name}`)
    })
  }

  console.log('\n✨ All tests successful!')
} catch (error) {
  console.error('❌ Test failed:', error)

  // Try to show which methods are actually available
  console.log(
    "\n📝 Debugging: Let's see what methods are available on SQL instance",
  )
  const db = new SQL({
    url: databaseUrl,
    tls: tlsConfig,
  })

  console.log('Available properties on SQL instance:')
  const props = Object.getOwnPropertyNames(Object.getPrototypeOf(db))
  props.forEach((prop) => {
    if (typeof (db as any)[prop] === 'function') {
      console.log(`  - ${prop}() [function]`)
    }
  })

  // Also check the instance properties
  console.log('\nInstance properties:')
  Object.keys(db).forEach((key) => {
    console.log(`  - ${key}: ${typeof (db as any)[key]}`)
  })

  process.exit(1)
}
