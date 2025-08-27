#!/bin/bash

# Simple build script for Render deployment
echo "🚀 Starting ChatTOEIC Backend build..."
echo "Working directory: $(pwd)"

# List files to verify we're in the right place
echo "Files in current directory:"
ls -la

# Check for Prisma schema
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Found Prisma schema"
else
    echo "❌ Prisma schema not found!"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production=false

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Build the application
echo "🏗️ Building application..."
npm run build

echo "✅ Build complete!"