# Reset Password Troubleshooting Guide

## Issues Fixed

### 1. **Missing Password Validation** ✅ FIXED
- **Problem**: No validation for password strength and requirements
- **Solution**: Added comprehensive password validation middleware
- **Impact**: Ensures strong passwords and better security

### 2. **Poor Error Handling** ✅ FIXED
- **Problem**: Inconsistent error responses and poor debugging
- **Solution**: Standardized error handling using AppError
- **Impact**: Better user feedback and easier debugging

### 3. **Missing Required Field Validation** ✅ FIXED
- **Problem**: No validation for missing password field
- **Solution**: Added validation for required fields
- **Impact**: Prevents crashes and provides clear error messages

### 4. **Inconsistent Response Handling** ✅ FIXED
- **Problem**: Service was calling res.json() instead of returning data
- **Solution**: Fixed response handling pattern
- **Impact**: Consistent API responses

## Password Requirements

The reset password now enforces the following requirements:

- **Minimum Length**: 6 characters
- **Uppercase Letter**: At least one (A-Z)
- **Lowercase Letter**: At least one (a-z)
- **Number**: At least one (0-9)

## API Endpoint

```
POST /api/auth/reset-password?token=<token>&id=<userId>
Content-Type: application/json

{
  "new_password": "NewPassword123!"
}
```

## Testing the Reset Password

### 1. Automated Tests
```bash
# Run all tests
npm test

# Run only reset password tests
npm test -- --testNamePattern="Reset Password"
```

### 2. Manual Testing
```bash
# Test forgot password flow
node tests/manual-test.js --email your-email@example.com

# Test reset password (after getting token from email)
node tests/manual-test.js --reset <token> <userId>
```

### 3. Using curl
```bash
# Reset password
curl -X POST "http://localhost:3000/api/auth/reset-password?token=YOUR_TOKEN&id=USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "NewPassword123!"}'
```

## Common Issues and Solutions

### Issue 1: "Invalid or expired token"
**Possible Causes**:
- Token has expired (15-minute limit)
- Token doesn't exist in database
- User ID is incorrect
- Token was already used

**Solutions**:
1. Request a new password reset
2. Check if token exists in database
3. Verify user ID is correct
4. Ensure token hasn't been used before

### Issue 2: "Password must contain at least one uppercase letter"
**Solution**: Use a password that meets all requirements:
- ✅ `NewPassword123!`
- ❌ `newpassword123`
- ❌ `NEWPASSWORD123`
- ❌ `NewPassword`

### Issue 3: "You cannot reuse your last 3 passwords"
**Solution**: Use a completely new password that hasn't been used in the last 3 password changes

### Issue 4: "New password is required"
**Solution**: Ensure you're sending the `new_password` field in the request body

## Debugging Steps

### 1. Check Token in Database
```javascript
// In MongoDB shell or Compass
db.users.findOne(
  { 
    _id: ObjectId("USER_ID"),
    resetPasswordToken: "TOKEN_VALUE",
    resetPasswordExpires: { $gt: new Date() }
  }
)
```

### 2. Check Server Logs
Look for these log messages:
- "Password reset successful"
- "Invalid or expired token"
- "Password validation failed"

### 3. Verify Email Configuration
Test email sending first:
```bash
curl -X POST http://localhost:3000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

## Security Features

### 1. Token Expiration
- Reset tokens expire after 15 minutes
- Prevents long-term token abuse

### 2. Single-Use Tokens
- Tokens are cleared after successful password reset
- Prevents token reuse

### 3. Password History
- Prevents reuse of last 3 passwords
- Maintains password security

### 4. Strong Password Requirements
- Enforces minimum security standards
- Reduces password-based attacks

## Frontend Integration

### 1. Extract Token from URL
```javascript
// From reset password link
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const userId = urlParams.get('id');
```

### 2. Make Reset Request
```javascript
const response = await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    new_password: password
  })
});

if (response.ok) {
  // Password reset successful
  console.log('Password updated successfully');
} else {
  const error = await response.json();
  console.error('Reset failed:', error.message);
}
```

### 3. Handle Validation Errors
```javascript
if (response.status === 400) {
  const data = await response.json();
  if (data.errors) {
    // Handle validation errors
    data.errors.forEach(error => {
      console.error(`${error.param}: ${error.msg}`);
    });
  } else {
    // Handle other errors
    console.error(data.message);
  }
}
```

## Monitoring and Logging

### 1. Successful Resets
- Log successful password resets
- Track user activity

### 2. Failed Attempts
- Log failed reset attempts
- Monitor for suspicious activity

### 3. Token Usage
- Track token generation and usage
- Monitor expiration patterns

## Best Practices

1. **Always validate passwords** on both frontend and backend
2. **Use HTTPS** for all password reset requests
3. **Rate limit** password reset requests
4. **Log security events** for monitoring
5. **Clear tokens** immediately after use
6. **Use strong password requirements**
7. **Implement account lockout** for multiple failed attempts 