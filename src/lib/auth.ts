import fs from 'node:fs'
import tls from 'node:tls'
import { betterAuth } from 'better-auth'
import { reactStartCookies } from 'better-auth/react-start'
import { Pool } from 'pg'

const secret = process.env.BETTER_AUTH_SECRET

if (process.env.NODE_ENV !== 'production' && !secret) {
  console.warn(
    '[better-auth] BETTER_AUTH_SECRET is not set. Sessions will use a default development secret.',
  )
}

const databaseUrl =
  process.env.BETTER_AUTH_DATABASE_URL ?? process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'BETTER_AUTH_DATABASE_URL (or DATABASE_URL) must be set to a PostgreSQL connection string.',
  )
}

// Configure SSL for Railway PostgreSQL
// Railway uses a self-signed certificate, so we need to handle SSL carefully
const isProduction = process.env.NODE_ENV === 'production'

const url = new URL(databaseUrl)
const sslMode = url.searchParams.get('sslmode')
if (sslMode) {
  url.searchParams.delete('sslmode')
}

const connectionString = url.toString().replace(/\?$/, '')
let sslConfig: any = false

const caCertPath = process.env.RAILWAY_CA_CERT_PATH
let caCert: string | undefined

if (caCertPath) {
  try {
    caCert = fs.readFileSync(caCertPath, 'utf8')
  } catch {
    console.warn(
      `[better-auth] Unable to read RAILWAY_CA_CERT_PATH="${caCertPath}". Falling back to insecure TLS.`,
    )
  }
}

const hostname = url.hostname
const connectingViaRailwayProxy = /\.proxy\.rlwy\.net$/i.test(hostname)
const runningOnRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID,
)

const checkRailwayProxyIdentity = (host: string, cert: tls.PeerCertificate) => {
  if (cert.subject.CN === 'localhost' && /\.proxy\.rlwy\.net$/i.test(host)) {
    return undefined
  }
  return tls.checkServerIdentity(host, cert)
}

const sslModeRequired = sslMode && sslMode.toLowerCase() === 'require'

if (sslModeRequired) {
  if (runningOnRailway) {
    if (caCert) {
      sslConfig = {
        rejectUnauthorized: true,
        ca: caCert,
        checkServerIdentity: connectingViaRailwayProxy
          ? checkRailwayProxyIdentity
          : tls.checkServerIdentity,
      }
    } else {
      console.warn(
        '[better-auth] Running on Railway without CA cert. Falling back to insecure TLS (rejectUnauthorized=false).',
      )
      sslConfig = {
        rejectUnauthorized: false,
      }
    }
  } else if (connectingViaRailwayProxy) {
    if (caCert) {
      sslConfig = {
        rejectUnauthorized: true,
        ca: caCert,
        checkServerIdentity: checkRailwayProxyIdentity,
      }
    } else {
      console.warn(
        '[better-auth] Railway proxy host detected without CA cert. Using TLS with rejectUnauthorized=false.',
      )
      sslConfig = {
        rejectUnauthorized: false,
      }
    }
  } else {
    sslConfig = caCert
      ? {
          rejectUnauthorized: true,
          ca: caCert,
        }
      : {
          rejectUnauthorized: !isProduction,
        }
  }
} else if (caCert && runningOnRailway) {
  sslConfig = {
    rejectUnauthorized: true,
    ca: caCert,
  }
}

// Create pg Pool for Better Auth
const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  max: Number(process.env.BETTER_AUTH_DATABASE_POOL_MAX ?? '10'),
})

export const auth = betterAuth({
  database: pool,
  secret,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [reactStartCookies()],
})

export const authDbPool = pool
