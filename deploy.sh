#!/bin/bash

# TaskAway Server Deployment Script
echo "🚀 Starting TaskAway Server deployment..."

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ Elastic Beanstalk CLI not found. Please install it first:"
    echo "   pip install awsebcli"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ server.js not found. Please run this script from the project root."
    exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
zip -r TaskAwayServer.zip . -x "node_modules/*" ".git/*" ".vscode/*" "*.md" "test-*.js" "deploy.sh"

# Check if zip was created successfully
if [ ! -f "TaskAwayServer.zip" ]; then
    echo "❌ Failed to create deployment package"
    exit 1
fi

echo "✅ Deployment package created: TaskAwayServer.zip"
echo "📁 Package size: $(du -h TaskAwayServer.zip | cut -f1)"

# Deploy to Elastic Beanstalk
echo "🌐 Deploying to Elastic Beanstalk..."
eb deploy

# Clean up
echo "🧹 Cleaning up..."
rm -f TaskAwayServer.zip

echo "✅ Deployment completed!"
echo "🔍 Check your Elastic Beanstalk environment for status updates."
