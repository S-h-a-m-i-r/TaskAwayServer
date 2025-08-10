import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import tasksRoutes from './tasksRoutes.js';
import fileRoutes from './fileRoutes.js';
import mongoose from 'mongoose';

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

  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStatusText[dbStatus] || 'unknown',
      readyState: dbStatus
    },
    environment: process.env.NODE_ENV || 'development',
    version: process.version
  };

  // If database is not connected, return error status
  if (dbStatus !== 1) {
    healthStatus.status = 'error';
    healthStatus.database.error = 'Database connection is not ready';
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

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', tasksRoutes);
router.use('/files', fileRoutes);

export default router;
