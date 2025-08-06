# Forgot Password Troubleshooting Guide

## Issues Fixed

### 1. **Missing Token Storage** ✅ FIXED
- **Problem**: Generated reset tokens were not being stored in the database
- **Solution**: Added `resetPasswordToken` and `resetPasswordExpires` fields to User model
- **Impact**: Now tokens are properly validated when users click reset links

### 2. **Missing Token Expiration** ✅ FIXED
- **Problem**: Reset tokens had no expiration time
- **Solution**: Added 15-minute expiration for security
- **Impact**: Tokens automatically expire for security

### 3. **Improved Error Handling** ✅ FIXED
- **Problem**: Poor error handling in email sending
- **Solution**: Added comprehensive error handling and validation
- **Impact**: Better debugging and user feedback

## Environment Variables Required

Make sure you have these environment variables set in your `.env` file:

```env
# Email Configuration (Choose one option)

# Option 1: SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Option 2: Gmail with App Password
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Application URLs
FRONTEND_BASE_URL=http://localhost:3001
BASE_URL=http://localhost:3000
```

## Testing Steps

### 1. Test Email Configuration
```bash
curl -X POST http://localhost:3000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'
```

### 2. Test Forgot Password
```bash
curl -X POST http://localhost:3000/api/auth/forget-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### 3. Test Password Reset
```bash
curl -X POST "http://localhost:3000/api/auth/reset-password?token=YOUR_TOKEN&id=USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "newPassword123"}'
```

## Common Issues and Solutions

### Issue 1: "Email configuration missing"
**Solution**: Set up your email environment variables properly

### Issue 2: "Template not found"
**Solution**: Ensure `src/templates/reset-password.hbs` exists

### Issue 3: "Invalid or expired token"
**Solution**: 
- Check if token is being generated and stored
- Verify token expiration time
- Ensure frontend is passing token correctly

### Issue 4: Gmail App Password Issues
**Solution**:
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password specifically for this application
3. Use the App Password instead of your regular password

## Debugging Tips

1. **Check Server Logs**: Look for email sending errors in console
2. **Verify Environment Variables**: Use the test email endpoint
3. **Check Database**: Verify tokens are being stored in User collection
4. **Test Email Templates**: Ensure templates are properly formatted

## Security Notes

- Reset tokens expire after 15 minutes
- Tokens are cleared after successful password reset
- Password reuse prevention is maintained
- All sensitive operations are logged for debugging 