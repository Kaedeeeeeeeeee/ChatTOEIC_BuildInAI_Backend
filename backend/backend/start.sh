#!/bin/bash

echo "🚀 ChatTOEIC Backend Start Script"
echo "Working directory: $(pwd)"
echo "Environment: $NODE_ENV"

# List directory contents for debugging
echo "Directory contents:"
ls -la

# Check if we're in the right place
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in current directory"
    echo "Available files:"
    find . -name "package.json" -type f 2>/dev/null
    exit 1
fi

echo "✅ Found package.json"

# Check for Prisma schema
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Prisma schema not found"
    exit 1
fi

echo "✅ Found Prisma schema"

# Check if dist directory and server.js exist
if [ ! -f "dist/server.js" ]; then
    echo "❌ Built server not found. Running build first..."
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install
    fi
    
    # Generate Prisma client and build
    echo "🔧 Building application..."
    npx prisma generate --schema=prisma/schema.prisma
    npm run build
fi

echo "🎯 Starting ChatTOEIC Backend Server..."
node dist/server.js