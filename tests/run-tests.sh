#!/bin/bash

# Test runner script for forgot password functionality

echo "🧪 Running Forgot Password Tests..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create test environment file if it doesn't exist
if [ ! -f ".env.test" ]; then
    echo "📝 Creating test environment file..."
    cat > .env.test << EOF
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key
FRONTEND_BASE_URL=http://localhost:3001
BASE_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=test@example.com
SMTP_PASS=test-password
EMAIL_FROM=test@example.com
EOF
fi

# Run the tests
echo "🚀 Starting tests..."
npm test

echo "✅ Tests completed!" 