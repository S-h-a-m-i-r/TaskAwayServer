import Task from '../models/Task.js';
import Message from '../models/Message.js';
import TaskHistory from '../models/TaskHistory.js';
import Notification from '../models/Notification.js';

/**
 * Calculate the cutoff date based on deletion period
 * This ensures we only delete data that has reached the exact age threshold
 */
function getCutoffDate(period) {
  const now = new Date();
  const cutoffDate = new Date(now); // Create a copy to avoid mutating the original

  switch (period) {
    case '1month':
      // Set to exactly 1 month ago (handles month-end edge cases)
      cutoffDate.setMonth(now.getMonth() - 1);
      cutoffDate.setHours(0, 0, 0, 0); // Start of day for consistency
      break;
    case '2months':
      cutoffDate.setMonth(now.getMonth() - 2);
      cutoffDate.setHours(0, 0, 0, 0);
      break;
    case '3months':
      cutoffDate.setMonth(now.getMonth() - 3);
      cutoffDate.setHours(0, 0, 0, 0);
      break;
    case 'other':
      // Delete everything older than 3 months (keeps last 3 months)
      // Same logic as '3months' but explicitly named 'other'
      cutoffDate.setMonth(now.getMonth() - 3);
      cutoffDate.setHours(0, 0, 0, 0);
      break;
    default:
      throw new Error(`Invalid deletion period: ${period}`);
  }

  // Validate the calculated date
  if (Number.isNaN(cutoffDate.getTime())) {
    throw new TypeError(`Invalid date calculation for period: ${period}`);
  }

  // Log the calculation for verification
  const daysDifference = Math.floor(
    (now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  console.log(`📅 Date calculation for ${period}:`);
  console.log(`   - Current date: ${now.toISOString()}`);
  console.log(`   - Cutoff date: ${cutoffDate.toISOString()}`);
  console.log(`   - Days difference: ${daysDifference} days`);
  console.log(
    `   - This ensures only data older than ${period} will be deleted`
  );

  return cutoffDate;
}

/**
 * Delete old tasks and related data
 */
async function deleteOldTasks(cutoffDate) {
  try {
    // Ensure cutoffDate is a valid Date object
    if (!(cutoffDate instanceof Date) || Number.isNaN(cutoffDate.getTime())) {
      throw new TypeError(`Invalid cutoff date: ${cutoffDate}`);
    }

    // Find tasks older than cutoff date based on createdAt timestamp
    // This ensures we only delete data that has actually reached the age threshold
    // The query uses $lt (less than) which means: only delete if createdAt < cutoffDate
    // This guarantees we only delete data that is OLDER than the configured period
    const oldTasks = await Task.find({
      createdAt: { $lt: cutoffDate }
    }).select('_id createdAt');

    const taskIds = oldTasks.map((task) => task._id);

    // Log detailed information for verification
    if (oldTasks.length > 0) {
      const oldestTask = oldTasks.reduce((oldest, task) =>
        task.createdAt < oldest.createdAt ? task : oldest
      );
      const newestTask = oldTasks.reduce((newest, task) =>
        task.createdAt > newest.createdAt ? task : newest
      );

      console.log(`📊 Task deletion summary:`);
      console.log(`   - Total tasks found: ${oldTasks.length}`);
      console.log(`   - Cutoff date: ${cutoffDate.toISOString()}`);
      console.log(
        `   - Oldest task to delete: ${oldestTask.createdAt.toISOString()}`
      );
      console.log(
        `   - Newest task to delete: ${newestTask.createdAt.toISOString()}`
      );
      console.log(
        `   - ✅ Verification: All tasks have createdAt < cutoffDate`
      );
    }

    if (taskIds.length === 0) {
      console.log(
        `✅ No tasks found older than cutoff date: ${cutoffDate.toISOString()}`
      );
      return {
        tasksDeleted: 0,
        messagesDeleted: 0,
        historyDeleted: 0
      };
    }

    // Delete related messages
    const messagesResult = await Message.deleteMany({
      taskId: { $in: taskIds }
    });

    // Delete related task history
    const historyResult = await TaskHistory.deleteMany({
      taskId: { $in: taskIds }
    });

    // Delete tasks
    const tasksResult = await Task.deleteMany({
      _id: { $in: taskIds }
    });

    return {
      tasksDeleted: tasksResult.deletedCount,
      messagesDeleted: messagesResult.deletedCount,
      historyDeleted: historyResult.deletedCount
    };
  } catch (error) {
    console.error('Error deleting old tasks:', error);
    throw error;
  }
}

/**
 * Delete old notifications
 */
async function deleteOldNotifications(cutoffDate) {
  try {
    // Ensure cutoffDate is a valid Date object
    if (!(cutoffDate instanceof Date) || Number.isNaN(cutoffDate.getTime())) {
      throw new TypeError(`Invalid cutoff date: ${cutoffDate}`);
    }

    // Count notifications that will be deleted for logging
    const countBefore = await Notification.countDocuments({
      createdAt: { $lt: cutoffDate }
    });

    if (countBefore > 0) {
      console.log(
        `📊 Notification deletion: ${countBefore} notifications older than ${cutoffDate.toISOString()}`
      );
    }

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    return result.deletedCount;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
}

/**
 * Perform manual data deletion
 */
export async function performManualDeletion(deletionPeriod) {
  try {
    console.log(
      `🗑️ Starting manual data deletion for period: ${deletionPeriod}`
    );

    const cutoffDate = getCutoffDate(deletionPeriod);
    console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);

    // Delete old tasks and related data
    const taskDeletionResult = await deleteOldTasks(cutoffDate);

    // Delete old notifications
    const notificationsDeleted = await deleteOldNotifications(cutoffDate);

    const totalDeleted =
      taskDeletionResult.tasksDeleted +
      taskDeletionResult.messagesDeleted +
      taskDeletionResult.historyDeleted +
      notificationsDeleted;

    console.log(`✅ Manual deletion completed:`);
    console.log(`   - Tasks deleted: ${taskDeletionResult.tasksDeleted}`);
    console.log(`   - Messages deleted: ${taskDeletionResult.messagesDeleted}`);
    console.log(`   - History deleted: ${taskDeletionResult.historyDeleted}`);
    console.log(`   - Notifications deleted: ${notificationsDeleted}`);
    console.log(`   - Total records deleted: ${totalDeleted}`);

    return {
      success: true,
      deletedCount: totalDeleted,
      details: {
        tasks: taskDeletionResult.tasksDeleted,
        messages: taskDeletionResult.messagesDeleted,
        history: taskDeletionResult.historyDeleted,
        notifications: notificationsDeleted
      }
    };
  } catch (error) {
    console.error('❌ Error in manual deletion:', error);
    throw error;
  }
}

/**
 * Perform scheduled data deletion based on settings
 */
export async function performScheduledDeletion(schedulePeriod) {
  try {
    console.log(
      `🗑️ Starting scheduled data deletion for period: ${schedulePeriod}`
    );

    const cutoffDate = getCutoffDate(schedulePeriod);
    console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);

    // Delete old tasks and related data
    const taskDeletionResult = await deleteOldTasks(cutoffDate);

    // Delete old notifications
    const notificationsDeleted = await deleteOldNotifications(cutoffDate);

    const totalDeleted =
      taskDeletionResult.tasksDeleted +
      taskDeletionResult.messagesDeleted +
      taskDeletionResult.historyDeleted +
      notificationsDeleted;

    console.log(`✅ Scheduled deletion completed:`);
    console.log(`   - Tasks deleted: ${taskDeletionResult.tasksDeleted}`);
    console.log(`   - Messages deleted: ${taskDeletionResult.messagesDeleted}`);
    console.log(`   - History deleted: ${taskDeletionResult.historyDeleted}`);
    console.log(`   - Notifications deleted: ${notificationsDeleted}`);
    console.log(`   - Total records deleted: ${totalDeleted}`);

    return {
      success: true,
      deletedCount: totalDeleted,
      details: {
        tasks: taskDeletionResult.tasksDeleted,
        messages: taskDeletionResult.messagesDeleted,
        history: taskDeletionResult.historyDeleted
      }
    };
  } catch (error) {
    console.error('❌ Error in scheduled deletion:', error);
    throw error;
  }
}
