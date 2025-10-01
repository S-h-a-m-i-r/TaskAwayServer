import cron from 'node-cron';
import mongoose from 'mongoose';
import {
  processRecurringTasks,
  processAutoCloseCompletedTasks
} from './schedulerUtils.js';

class Scheduler {
  constructor() {
    this.cronJob = null;
  }

  start() {
    if (this.cronJob) {
      this.cronJob.stop(); // restart safety
    }

    this.cronJob = cron.schedule(
      '0 2 * * *',
      async () => {
        console.log('🕐 Running scheduler tasks at:', new Date().toISOString());

        try {
          await Promise.all([
            processRecurringTasks(),
            processAutoCloseCompletedTasks()
          ]);
          console.log('✅ Scheduler tasks completed');
        } catch (err) {
          console.error('❌ Scheduler error:', err);
        }
      },
      {
        scheduled: true,
        timezone: 'UTC'
      }
    );

    console.log('📅 Scheduler started (daily at 2AM UTC)');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('⏹️ Scheduler stopped');
    }
  }

  getStatus() {
    return {
      isRunning: !!this.cronJob,
      nextRun: this.cronJob ? 'Daily at 2 AM UTC (12 PM AEST)' : null,
      timezone: 'UTC (2 AM UTC = 12 PM AEST)',
      cronExpression: '0 2 * * *',
      functions: [
        'Process recurring tasks',
        'Auto-close completed tasks older than 24 hours'
      ]
    };
  }

  // Manual trigger for testing
  async triggerProcessing() {
    console.log('🔧 Manually triggering scheduler processing...');
    try {
      await Promise.all([
        processRecurringTasks(),
        processAutoCloseCompletedTasks()
      ]);
      console.log('✅ Manual trigger completed successfully');
    } catch (error) {
      console.error('❌ Error in manual trigger:', error);
      throw error;
    }
  }
}

// Export singleton
export default new Scheduler();
