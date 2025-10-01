import express from 'express';
import schedulerService from '../services/schedulerService.js';

const router = express.Router();

/**
 * GET /api/scheduler/status
 * Get the current status of the scheduler
 */
router.get('/status', (req, res) => {
  try {
    const status = schedulerService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message
    });
  }
});

/**
 * POST /api/scheduler/trigger
 * Manually trigger the recurring task processing
 * This is useful for testing
 */
router.post('/trigger', async (req, res) => {
  try {
    console.log('🔧 Manual trigger requested for recurring task processing');
    await schedulerService.triggerProcessing();

    res.json({
      success: true,
      message: 'Recurring task processing triggered successfully'
    });
  } catch (error) {
    console.error('❌ Error triggering scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger recurring task processing',
      error: error.message
    });
  }
});

/**
 * POST /api/scheduler/start
 * Start the scheduler
 */
router.post('/start', (req, res) => {
  try {
    schedulerService.start();
    res.json({
      success: true,
      message: 'Scheduler started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start scheduler',
      error: error.message
    });
  }
});

/**
 * POST /api/scheduler/stop
 * Stop the scheduler
 */
router.post('/stop', (req, res) => {
  try {
    schedulerService.stop();
    res.json({
      success: true,
      message: 'Scheduler stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop scheduler',
      error: error.message
    });
  }
});

export default router;
