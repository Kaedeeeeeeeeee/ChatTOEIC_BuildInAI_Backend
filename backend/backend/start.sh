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

# Fix any failed migrations first
echo "🔧 Fixing any failed migrations..."
if [ -f "fix-migration.js" ]; then
    node fix-migration.js
    echo "✅ Migration fix script completed"
else
    echo "⚠️  Migration fix script not found, proceeding with deploy..."
fi

# Deploy database migrations before starting server
echo "📊 Deploying database migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma || echo "Migration deploy failed, but continuing..."

# 紧急修复：添加realQuestions字段
echo "🚨 Running realQuestions field emergency fix..."
echo "Current directory: $(pwd)"
echo "Looking for fix-realquestions-field.js..."
find . -name "fix-realquestions-field.js" -type f 2>/dev/null

if [ -f "fix-realquestions-field.js" ]; then
    echo "✅ Found fix-realquestions-field.js in current directory"
    node fix-realquestions-field.js
    echo "✅ realQuestions field fix completed"
elif [ -f "./fix-realquestions-field.js" ]; then
    echo "✅ Found fix-realquestions-field.js with relative path"
    node ./fix-realquestions-field.js
    echo "✅ realQuestions field fix completed"
else
    echo "⚠️  realQuestions fix script not found in current directory"
    echo "Directory contents:"
    ls -la | grep -E "\.(js|ts)$"
    echo "Proceeding without fix..."
fi

echo "✅ Database setup completed"

echo "🎯 Starting ChatTOEIC Backend Server..."
node dist/server.js