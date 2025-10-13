# Railway PostgreSQL SSL Certificate Issue (Resolved)

## tl;dr

Railway's TCP proxy (`*.proxy.rlwy.net`) terminates TLS with a certificate whose
**common name is `localhost`**. The chain is valid when you anchor it with
Railway's CA, but the hostname mismatch makes Node's TLS client reject the
connection with `SELF_SIGNED_CERT_IN_CHAIN`.

We now load the Railway CA, keep certificate validation enabled, and skip the
hostname check only for the known proxy host pattern. Authentication is working
again both locally (Bun) and in production.

## Root Cause

- External Railway PostgreSQL connections go through `crossover.proxy.rlwy.net`.
- The presented certificate chain ends in a leaf certificate with
  `CN=localhost` and `SAN=DNS:localhost`.
- Node/Bun's `tls` implementation validates the hostname, so a strict
  `rejectUnauthorized: true` configuration fails with
  `ERR_TLS_CERT_ALTNAME_INVALID`.
- Flipping `rejectUnauthorized` to `false` does establish a connection, but it
  disables _all_ TLS validation and Better Auth still surfaced noisy warnings.

## Fix

`src/lib/auth.ts` now:

1. Parses the database URL, removes the `sslmode=require` flag from the query
   string, and keeps any other parameters intact.
2. Loads the CA file pointed to by `RAILWAY_CA_CERT_PATH` when present.
3. Detects when we are talking to a Railway proxy host (`/.proxy\.rlwy\.net/`)
   while running outside of Railway.
4. Uses a custom `checkServerIdentity` that:
   - Skips the hostname comparison only when the certificate subject is
     `localhost` **and** the host matches the Railway proxy pattern.
   - Falls back to `tls.checkServerIdentity` for every other host/certificate.
5. Keeps full verification on Railway (production) and reuses the CA if
   available.

```ts
const pool = new Pool({
  connectionString,
  ssl: caCert
    ? {
        rejectUnauthorized: true,
        ca: caCert,
        checkServerIdentity: (host, cert) => {
          if (
            cert.subject.CN === 'localhost' &&
            /\.proxy\.rlwy\.net$/i.test(host)
          ) {
            return undefined
          }
          return tls.checkServerIdentity(host, cert)
        },
      }
    : { rejectUnauthorized: false },
})
```

## Verification

- `node` / `bun` scripts using `Pool` now connect and return `SELECT version()`
  successfully.
- `psql` with `PGSSLMODE=require` works as before. With `verify-full` it still
  fails (expected) because the certificate really is for `localhost`.
- First Better Auth sign-in locally succeeds and creates the tables.

## Env/Setup Notes

- `.env.local` should continue to point to the public Railway URL **with**
  `sslmode=require` and set `RAILWAY_CA_CERT_PATH=certs/railway-ca.pem`.
- If the CA file cannot be read we log a warning and fall back to
  `rejectUnauthorized: false` so developers stay unblocked, but we strongly
  recommend keeping the CA file in place.
- When running inside Railway (`RAILWAY_ENVIRONMENT` or `RAILWAY_PROJECT_ID`
  set) we never bypass hostname checks.

## Useful Commands

```bash
# Quick connectivity smoke test with the bundled pg client
BETTER_AUTH_DATABASE_URL="postgresql://.../railway?sslmode=require" \
RAILWAY_CA_CERT_PATH=certs/railway-ca.pem \
node <<'NODE'
const { Pool } = require('pg');
const tls = require('tls');
const fs = require('fs');
const url = new URL(process.env.BETTER_AUTH_DATABASE_URL);
url.searchParams.delete('sslmode');
const pool = new Pool({
  connectionString: url.toString().replace(/\?$/, ''),
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(process.env.RAILWAY_CA_CERT_PATH, 'utf8'),
    checkServerIdentity: (host, cert) => {
      if (cert.subject.CN === 'localhost' && /\.proxy\.rlwy\.net$/i.test(host)) {
        return undefined;
      }
      return tls.checkServerIdentity(host, cert);
    },
  },
});
pool.query('SELECT NOW()').then(({ rows }) => {
  console.log('Connected at:', rows[0].now);
  process.exit(0);
});
NODE

# Inspect the presented certificate chain manually (CN shows up as localhost)
openssl s_client -showcerts \
  -servername crossover.proxy.rlwy.net \
  -connect crossover.proxy.rlwy.net:11287 </dev/null | openssl x509 -noout -subject
```

## Follow-up

- Keep an eye on Railway updates—if they issue proper proxy certificates we can
  delete the hostname override.
- Documented the behaviour in `CLAUDE.md` so agents know why the override
  exists.
