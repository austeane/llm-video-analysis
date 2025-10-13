#!/bin/bash

# Setup script for Railway PostgreSQL connection
echo "🚂 Railway Database Setup for LLM Video Analysis"
echo "================================================"
echo ""

# Check if linked to Railway
railway status > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Not linked to a Railway project"
    echo "Run: railway link"
    echo "Then select the 'Quidditch Video Analysis' project"
    exit 1
fi

echo "✅ Linked to Railway project"
echo ""

# Get database URL
echo "📦 Fetching PostgreSQL connection details..."
echo ""

# Try to get variables from Postgres service
DB_URL=$(railway variables --service postgres --json 2>/dev/null | grep -o '"DATABASE_PUBLIC_URL":"[^"]*' | cut -d'"' -f4)

if [ -z "$DB_URL" ]; then
    # Try without service flag
    DB_URL=$(railway variables --json 2>/dev/null | grep -o '"DATABASE_PUBLIC_URL":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$DB_URL" ]; then
    echo "❌ Could not fetch DATABASE_PUBLIC_URL"
    echo ""
    echo "Manual steps:"
    echo "1. Go to your Railway dashboard"
    echo "2. Click on the Postgres service"
    echo "3. Go to 'Connect' tab"
    echo "4. Copy DATABASE_PUBLIC_URL"
    echo "5. Add to .env.local as:"
    echo "   BETTER_AUTH_DATABASE_URL=<paste-url-here>?sslmode=require"
    exit 1
fi

# Add sslmode for local development
DB_URL_WITH_SSL="${DB_URL}?sslmode=require"

echo "✅ Found database URL!"
echo ""
echo "📝 Adding to .env.local..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Creating .env.local..."
    touch .env.local
fi

# Check if BETTER_AUTH_DATABASE_URL already exists
if grep -q "^BETTER_AUTH_DATABASE_URL=" .env.local; then
    echo "Updating existing BETTER_AUTH_DATABASE_URL..."
    # Use sed to update the line
    sed -i.bak "s|^BETTER_AUTH_DATABASE_URL=.*|BETTER_AUTH_DATABASE_URL=$DB_URL_WITH_SSL|" .env.local
else
    echo "Adding BETTER_AUTH_DATABASE_URL..."
    echo "" >> .env.local
    echo "# Railway PostgreSQL (from Quidditch project)" >> .env.local
    echo "BETTER_AUTH_DATABASE_URL=$DB_URL_WITH_SSL" >> .env.local
fi

echo ""
echo "✅ Database URL configured!"
echo ""
echo "🎉 Setup complete! Your app can now connect to Railway's PostgreSQL."
echo ""
echo "Next steps:"
echo "1. Restart your dev server: bun run dev"
echo "2. The authentication system should now work"
echo "3. Deploy to Railway: railway up"
echo ""