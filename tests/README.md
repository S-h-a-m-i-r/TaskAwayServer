# Forgot Password Test Suite

This test suite covers the complete forgot password functionality including email sending, token validation, and password reset.

## Test Coverage

### 🔐 Forgot Password Flow Tests
- ✅ Valid email requests
- ✅ Invalid email formats
- ✅ Non-existent email handling
- ✅ Email sending failures
- ✅ Case-insensitive email lookup

### 🔑 Password Reset Tests
- ✅ Valid token and password reset
- ✅ Invalid token handling
- ✅ Expired token handling
- ✅ Non-existent user handling
- ✅ Password reuse prevention
- ✅ Missing password validation

### 📧 Email Service Tests
- ✅ Email configuration validation
- ✅ Template file validation
- ✅ Email sending success/failure

### 🔄 Integration Tests
- ✅ Complete end-to-end flow
- ✅ Token generation and storage
- ✅ Password update verification

## Running Tests

### Quick Start
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run using the test script
./tests/run-tests.sh
```

### Manual Setup
```bash
# Install dependencies
npm install

# Create test environment file
cp .env.example .env.test

# Run tests
npm test
```

## Test Environment

The tests use:
- **MongoDB Memory Server**: In-memory database for testing
- **Jest**: Test framework
- **Supertest**: HTTP testing
- **Mocked Email Service**: Prevents actual emails during testing

## Test Structure

```
tests/
├── auth.test.js          # Main test file
├── setup.js             # Jest configuration
├── run-tests.sh         # Test runner script
└── README.md           # This file
```

## Environment Variables for Testing

Create a `.env.test` file with:

```env
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key
FRONTEND_BASE_URL=http://localhost:3001
BASE_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=test@example.com
SMTP_PASS=test-password
EMAIL_FROM=test@example.com
```

## Test Scenarios

### 1. Happy Path
- User requests password reset with valid email
- Email is sent with reset link
- User clicks link and resets password
- Token is cleared after successful reset

### 2. Error Handling
- Invalid email formats
- Non-existent users
- Expired tokens
- Email sending failures
- Password reuse attempts

### 3. Security
- Token expiration (15 minutes)
- Password reuse prevention
- Token cleanup after use
- Case-insensitive email lookup

## Debugging Tests

If tests fail:

1. **Check MongoDB Connection**: Ensure MongoDB Memory Server starts properly
2. **Environment Variables**: Verify `.env.test` file exists
3. **Dependencies**: Run `npm install` to ensure all packages are installed
4. **Mock Issues**: Check if email service mocking is working correctly

## Adding New Tests

To add new test cases:

1. Add test in the appropriate `describe` block in `auth.test.js`
2. Follow the existing pattern for mocking and assertions
3. Ensure proper cleanup in `beforeEach` hooks
4. Test both success and failure scenarios

## Coverage Report

After running `npm run test:coverage`, check the `coverage/` directory for detailed coverage reports. 