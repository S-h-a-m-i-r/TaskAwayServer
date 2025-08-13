# Elastic Beanstalk Troubleshooting Guide

## Issues Fixed

### 1. Missing Configuration Files
- ✅ Created `.ebextensions/` directory with proper Node.js configuration
- ✅ Added `buildspec.yml` for CodePipeline integration
- ✅ Created `.ebignore` to exclude unnecessary files
- ✅ Added health check endpoints to server.js

### 2. Health Check Endpoints
Your server now has these endpoints for monitoring:
- `/health` - Basic health status
- `/db-status` - Database connection status

## Next Steps

### 1. Update Your Elastic Beanstalk Environment
1. Go to AWS Console → Elastic Beanstalk
2. Select your environment
3. Click "Configuration" → "Software"
4. Set these environment variables:
   ```
   NODE_ENV=production
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

### 2. Verify CodePipeline Integration
1. Check your CodePipeline in AWS Console
2. Ensure the source stage is connected to your Git repository
3. Verify the build stage uses the `buildspec.yml` file
4. Confirm the deploy stage targets your Elastic Beanstalk environment

### 3. Test Health Checks
After deployment, test these URLs:
- `https://your-eb-url.elasticbeanstalk.com/health`
- `https://your-eb-url.elasticbeanstalk.com/db-status`

## Common Issues & Solutions

### Issue: "No Data" in Health Status
**Solution**: 
- Check if your app is listening on the correct port (8081)
- Verify environment variables are set correctly
- Check CloudWatch logs for errors

### Issue: Application Not Starting
**Solution**:
- Check the `/var/log/nodejs/nodejs.log` file in your EB instance
- Verify MongoDB connection string is correct
- Ensure all required environment variables are set

### Issue: CodePipeline Not Deploying
**Solution**:
- Check build logs in CodeBuild
- Verify the `buildspec.yml` file is in your repository
- Ensure your EB environment name matches the pipeline configuration

## Manual Deployment

If CodePipeline fails, you can deploy manually:

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB (if not already done)
eb init

# Deploy
./deploy.sh
```

## Monitoring & Logs

### View Logs
1. **EB Console**: Environment → Logs → Request Logs
2. **CloudWatch**: Logs → Log Groups → `/aws/elasticbeanstalk/...`
3. **EC2 Instance**: SSH into instance and check `/var/log/`

### Key Log Files
- `/var/log/nodejs/nodejs.log` - Application logs
- `/var/log/nginx/access.log` - HTTP requests
- `/var/log/eb-activity.log` - Deployment activity

## Environment Variables Required

Make sure these are set in your EB environment:
```
NODE_ENV=production
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_BASE_URL=your_frontend_url
```

## Security Groups

Update the security group in `.ebextensions/01_environment.config`:
- Replace `sg-xxxxxxxxx` with your actual security group ID
- Ensure it allows inbound traffic on port 80/443

## Testing Deployment

1. **Health Check**: `GET /health`
2. **Database Status**: `GET /db-status`
3. **API Endpoints**: `GET /api/...`

## Need Help?

If issues persist:
1. Check CloudWatch logs for detailed error messages
2. Verify all environment variables are set
3. Test MongoDB connection from the EB instance
4. Check security group and VPC configuration
