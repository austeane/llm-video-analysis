# Railway Deployment Guide

This guide will help you deploy the LLM Video Analysis app to Railway with your Google API key.

## Prerequisites

- Railway CLI installed (`brew install railway` on macOS)
- Railway account (sign up at https://railway.app)
- Google API Key (already configured in your environment)

## Deployment Steps

### 1. Login to Railway

```bash
railway login
```

This will open your browser for authentication.

### 2. Initialize Railway Project

```bash
railway init -n llm-video-analysis
```

This creates a new Railway project named "llm-video-analysis".

### 3. Set Environment Variables

Set your Google API key and other configuration:

```bash
# Set Google API key
railway variables set GOOGLE_API_KEY=AIzaSyDd5miKfat8yvZHjo5mZ4AhAem11VY7Ewo

# Set to use real API (not stub mode)
railway variables set USE_STUB=false

# Set the model to use
railway variables set DEFAULT_MODEL=gemini-2.0-flash-exp
```

### 4. Deploy the Application

```bash
railway up
```

This will:

- Build your application using Bun
- Deploy it to Railway's infrastructure
- Automatically handle the production server

### 5. Generate Public Domain

```bash
railway domain
```

This will generate a public URL for your application.

## Verifying Deployment

After deployment, you can:

1. Check the deployment status:

   ```bash
   railway status
   ```

2. View logs:

   ```bash
   railway logs
   ```

3. Open your app in the browser:
   ```bash
   railway open
   ```

## Updating Environment Variables

If you need to update environment variables later:

```bash
# View current variables
railway variables

# Update a variable
railway variables set VARIABLE_NAME=new-value

# Remove a variable
railway variables remove VARIABLE_NAME
```

## Monitoring and Debugging

- **View Logs**: `railway logs -n 100` (last 100 lines)
- **SSH into container**: `railway shell`
- **Restart service**: `railway restart`

## Important Notes

1. **API Key Security**: Your Google API key is stored securely in Railway's environment variables and is never exposed in your code or logs.

2. **Costs**:
   - Railway offers a free tier with $5/month credits
   - Google's Gemini API has free tier limits (check current limits at https://ai.google.dev/pricing)

3. **Performance**: The app uses Bun for optimal performance and fast cold starts.

## Troubleshooting

If you encounter issues:

1. **Check logs**: `railway logs` to see any error messages
2. **Verify environment variables**: `railway variables` to ensure all are set correctly
3. **Check build**: Ensure `bun run build` works locally before deploying
4. **API Key**: Verify your Google API key is valid and has the necessary permissions

## Local Testing with Production Config

To test locally with the same configuration as production:

```bash
# Export the variables locally
export GOOGLE_API_KEY=AIzaSyDd5miKfat8yvZHjo5mZ4AhAem11VY7Ewo
export USE_STUB=false
export DEFAULT_MODEL=gemini-2.0-flash-exp

# Run the production build
bun run build
bun server.ts
```

## Next Steps

After deployment, you can:

- Monitor usage in the Railway dashboard
- Set up custom domains if needed
- Configure auto-deployments from GitHub
- Set up deployment notifications

Visit your Railway dashboard at https://railway.app to manage your deployment.
