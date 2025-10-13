# Railway Deployment Status

## Deployment Information
- **Date**: October 13, 2025
- **Production URL**: https://quidditch-video-analysis-production.up.railway.app
- **Status**: ✅ Accessible (HTTP 200) – latest light-only UI live

## Configuration
- **Project**: quidditch-video-analysis
- **Environment**: production
- **Service**: quidditch-video-analysis
- **Database**: PostgreSQL (Railway-hosted)

## Environment Variables Set
✅ **Core Variables**:
- `BETTER_AUTH_SECRET` - Production secret configured
- `BETTER_AUTH_DATABASE_URL` - Connected to Railway PostgreSQL
- `GOOGLE_API_KEY` - Configured for AI services
- `GOOGLE_CLOUD_PROJECT` - gen-lang-client-0487815497
- `DEFAULT_MODEL` - gemini-2.5-pro
- `USE_STUB` - false (production mode)

✅ **Railway Variables**:
- `RAILWAY_PUBLIC_DOMAIN` - quidditch-video-analysis-production.up.railway.app
- `RAILWAY_ENVIRONMENT` - production
- All Railway internal variables configured

## Deployment History
1. **Latest Successful**: ID 9093cf20-a712-4550-ae47-6a7c51295ca7 (Oct 13, 2025 07:02 UTC)
   - Status: SUCCESS
   - Trigger: GitHub auto-deploy from `main`
   - Notes: Uses Railpack defaults (auto-detected Bun)

2. **Prior Successful (Manual)**: ID 40136545-cba1-45fc-8e6d-b1aeee15646c (Oct 13, 2025 06:41 UTC)
   - Status: SUCCESS
   - Trigger: `railway deployment up` from local workspace (manual)
   - Notes: Contains dark-mode removal and updated light theme

3. **Previous Successful**: ID 249d5c00-c658-46a7-a268-1abf9307e060 (Oct 13, 2025 06:00 UTC)
   - Status: REMOVED (superseded)
   - Notes: Served pre-light-theme build with dark toggle

4. **Recent Failed**: ID c1071b0c-2b0d-4479-aa41-944872286415 (Oct 13, 2025 07:11 UTC)
   - Status: FAILED
   - Issue: Invalid `build.buildEnvironment` value while experimenting with Railpack Metal config

5. **Earlier Failed**: ID 90bacd04-21f8-46a9-b095-9f371394c08e (Oct 13, 2025 05:50 UTC)
   - Status: FAILED
   - Issue: Build failure (likely dependency mismatch during Vite build)

## Current Status
Production now serves the updated light-only UI (verified via curl; no `dark:` classes present). Health check returns 200 and Vite build completed successfully on Railway. GitHub auto-deploys are active for the `main` branch; the service builds with Railpack (Bun provider). Ensure the service stays on the **Metal** build environment via the Railway dashboard. A fresh manual Railpack deployment (`98a8689e-8097-4c9a-8e00-fe65ca98cdba`) is currently building to validate the new configuration.

## Recommended Actions
1. **Maintain Runtime Pins**: Keep `package.json` `"engines"` (Node ≥22.12, Bun 1.3.0) in sync with any future upgrades and update the Railway service accordingly.
2. **Monitor Auto-Deploys**: Review GitHub-triggered deployments for the next few pushes to ensure Railpack plans stay stable and the Metal environment remains selected.
3. **Document Manual Deploy Flow**: Keep a quick reference for `railway deployment up` in case you need a hotfix outside the GitHub pipeline.

## Access Information
- **Production URL**: https://quidditch-video-analysis-production.up.railway.app
- **Local Development**: http://localhost:3000 (currently running)
- **Test User**: test.user@example.com / TestPassword123!

## Notes
- All code changes have been committed to GitHub
- Environment variables have been configured in Railway
- The database connection is working correctly
- The application runs successfully locally with all new features
