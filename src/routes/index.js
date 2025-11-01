import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import tasksRoutes from './tasksRoutes.js';
import fileRoutes from './fileRoutes.js';
import teamManagementRoutes from './teamManagementRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import mongoose from 'mongoose';
import paymentRoute from './paymentRoute.js';
import creditsRoute from './creditsRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import schedulerRoutes from './schedulerRoutes.js';
import dataDeletionRoutes from './dataDeletionRoutes.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  // Check AWS credentials
  const awsStatus = {
    accessKey: process.env.AWS_ACCESS_KEY ? 'SET' : 'MISSING',
    secretKey: process.env.AWS_SECRET_KEY ? 'SET' : 'MISSING',
    region: process.env.AWS_REGION || 'NOT_SET',
    bucket: process.env.AWS_BUCKET_NAME || 'NOT_SET'
  };

  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStatusText[dbStatus] || 'unknown',
      readyState: dbStatus
    },
    aws: awsStatus,
    environment: process.env.NODE_ENV || 'development',
    version: process.version
  };

  // Check for critical failures
  const criticalIssues = [];

  if (dbStatus !== 1) {
    criticalIssues.push('Database connection is not ready');
  }

  if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY) {
    criticalIssues.push('AWS credentials are missing');
  }

  if (criticalIssues.length > 0) {
    healthStatus.status = 'error';
    healthStatus.issues = criticalIssues;
    return res.status(503).json(healthStatus);
  }

  res.status(200).json(healthStatus);
});

// Database status endpoint
router.get('/db-status', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbInfo = {
    status: dbStatusText[dbStatus] || 'unknown',
    readyState: dbStatus,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    port: mongoose.connection.port,
    collections: Object.keys(mongoose.connection.collections || {}),
    models: Object.keys(mongoose.connection.models || {}),
    timestamp: new Date().toISOString()
  };

  res.status(200).json(dbInfo);
});

// AWS connectivity test endpoint
router.get('/aws-status', async (req, res) => {
  try {
    const awsStatus = {
      credentials: {
        accessKey: process.env.AWS_ACCESS_KEY ? 'SET' : 'MISSING',
        secretKey: process.env.AWS_SECRET_KEY ? 'SET' : 'MISSING',
        region: process.env.AWS_REGION || 'NOT_SET',
        bucket: process.env.AWS_BUCKET_NAME || 'NOT_SET'
      },
      timestamp: new Date().toISOString()
    };

    // Test S3 connectivity if credentials are available
    if (process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_KEY) {
      try {
        const { testS3Connection } = await import('../config/s3.js');
        await testS3Connection();
        awsStatus.s3Connection = 'SUCCESS';
      } catch (error) {
        awsStatus.s3Connection = 'FAILED';
        awsStatus.s3Error = error.message;
      }
    } else {
      awsStatus.s3Connection = 'SKIPPED - No credentials';
    }

    res.status(200).json(awsStatus);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check AWS status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', tasksRoutes);
router.use('/files', fileRoutes);
router.use('/team', teamManagementRoutes);
router.use('/notifications', notificationRoutes);
router.use('/stripe', paymentRoute);
router.use('/credits', creditsRoute);
router.use('/invoices', invoiceRoutes);
router.use('/scheduler', schedulerRoutes);
router.use('/admin/data-deletion', dataDeletionRoutes);
export default router;
