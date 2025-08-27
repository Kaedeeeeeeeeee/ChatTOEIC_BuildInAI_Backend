#!/bin/bash

# Render build script for ChatTOEIC Backend
# This script ensures Prisma can find the schema and builds the application

echo "Starting ChatTOEIC Backend build process..."
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

# Verify Prisma schema exists
if [ ! -f "prisma/schema.prisma" ]; then
    echo "Error: Prisma schema not found at prisma/schema.prisma"
    echo "Available files:"
    find . -name "*.prisma" -type f
    exit 1
fi

echo "✅ Prisma schema found"

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "Error: Failed to generate Prisma client"
    exit 1
fi

echo "✅ Prisma client generated successfully"

# Install dependencies (should already be done by Render)
echo "Verifying dependencies..."
npm ci

# Build the application  
echo "Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "Error: Failed to build application"
    exit 1
fi

echo "✅ Build completed successfully"
echo "Build artifacts:"
ls -la dist/

echo "🎉 ChatTOEIC Backend build finished!"