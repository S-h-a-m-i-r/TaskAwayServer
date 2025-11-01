import DataDeletionSettings from '../models/DataDeletionSettings.js';
import { performManualDeletion } from '../services/dataDeletionService.js';

/**
 * Manual data deletion
 * POST /api/admin/data-deletion/manual
 */
export const manualDeletion = async (req, res, next) => {
  try {
    const { deletionPeriod } = req.body;

    if (!deletionPeriod) {
      return res.status(400).json({
        success: false,
        message: 'Deletion period is required'
      });
    }

    const validPeriods = ['1month', '2months', '3months', 'other'];
    if (!validPeriods.includes(deletionPeriod)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid deletion period. Must be one of: 1month, 2months, 3months, other'
      });
    }

    const result = await performManualDeletion(deletionPeriod);

    res.status(200).json({
      success: true,
      message: 'Data deleted successfully',
      deletedCount: result.deletedCount,
      details: result.details
    });
  } catch (error) {
    console.error('Error in manual deletion controller:', error);
    next(error);
  }
};

/**
 * Configure scheduled data deletion
 * POST /api/admin/data-deletion/scheduled
 */
export const configureScheduledDeletion = async (req, res, next) => {
  try {
    const { schedulePeriod } = req.body;

    if (!schedulePeriod) {
      return res.status(400).json({
        success: false,
        message: 'Schedule period is required'
      });
    }

    const validPeriods = ['1month', '2months', '3months'];
    if (!validPeriods.includes(schedulePeriod)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid schedule period. Must be one of: 1month, 2months, 3months'
      });
    }

    // Find and update existing settings, or create new one
    let settings = await DataDeletionSettings.findOne({ isActive: true });

    if (settings) {
      settings.schedulePeriod = schedulePeriod;
      settings.isActive = true;
      settings.updatedAt = new Date();
      await settings.save();
    } else {
      // Deactivate any existing settings first
      await DataDeletionSettings.updateMany(
        { isActive: true },
        { isActive: false }
      );

      // Create new settings
      settings = new DataDeletionSettings({
        schedulePeriod,
        isActive: true
      });
      await settings.save();
    }

    res.status(200).json({
      success: true,
      message: 'Scheduled deletion configured successfully',
      data: {
        schedulePeriod: settings.schedulePeriod,
        isActive: settings.isActive,
        createdAt: settings.createdAt
      }
    });
  } catch (error) {
    console.error('Error in scheduled deletion configuration:', error);
    next(error);
  }
};

/**
 * Get current scheduled deletion settings
 * GET /api/admin/data-deletion/settings
 */
export const getDeletionSettings = async (req, res, next) => {
  try {
    const settings = await DataDeletionSettings.findOne({ isActive: true });

    if (!settings) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No scheduled deletion configured'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        schedulePeriod: settings.schedulePeriod,
        isActive: settings.isActive,
        lastExecutionDate: settings.lastExecutionDate,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting deletion settings:', error);
    next(error);
  }
};

/**
 * Cancel scheduled data deletion
 * DELETE /api/admin/data-deletion/scheduled
 */
export const cancelScheduledDeletion = async (req, res, next) => {
  try {
    // Find and deactivate active settings
    const settings = await DataDeletionSettings.findOne({ isActive: true });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No active scheduled deletion found'
      });
    }

    settings.isActive = false;
    settings.updatedAt = new Date();
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Scheduled deletion cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling scheduled deletion:', error);
    next(error);
  }
};
