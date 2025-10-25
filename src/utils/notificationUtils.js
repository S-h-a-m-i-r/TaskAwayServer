import eventEmitter from '../services/eventService.js';
import notificationService from '../services/notificationService.js';

/**
 * Notification Utility Functions
 * Provides easy-to-use functions for emitting notification events
 * Now supports both database storage and real-time Socket.IO delivery
 */

/**
 * Emit task created notification
 * @param {string} taskId - Task ID
 * @param {string} createdBy - User ID who created the task
 */
export function notifyTaskCreated(taskId, createdBy) {
  eventEmitter.emit('task.created', {
    taskId,
    createdBy
  });
}

/**
 * Emit new message notification
 * @param {string} taskId - Task ID
 * @param {string} senderId - User ID who sent the message
 * @param {string} messageId - Message ID
 */
export function notifyNewMessage(taskId, senderId, messageId) {
  eventEmitter.emit('message.sent', {
    taskId,
    senderId,
    messageId
  });
}

/**
 * Emit task assigned notification
 * @param {string} taskId - Task ID
 * @param {string} assignedTo - User ID who was assigned
 * @param {string} assignedBy - User ID who made the assignment
 */
export function notifyTaskAssigned(taskId, assignedTo, assignedBy) {
  eventEmitter.emit('task.assigned', {
    taskId,
    assignedTo,
    assignedBy
  });
}

/**
 * Emit task status changed notification
 * @param {string} taskId - Task ID
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {string} changedBy - User ID who changed the status
 */
export function notifyTaskStatusChanged(
  taskId,
  oldStatus,
  newStatus,
  changedBy
) {
  eventEmitter.emit('task.statusChanged', {
    taskId,
    oldStatus,
    newStatus,
    changedBy
  });
}

/**
 * Emit custom notification event
 * @param {string} eventName - Event name
 * @param {Object} data - Event data
 */
export function emitCustomNotification(eventName, data) {
  eventEmitter.emit(eventName, data);
}

/**
 * Send real-time notification only (no database storage)
 * @param {string} userId - User ID to send notification to
 * @param {Object} notificationData - Notification data
 */
export function sendRealtimeNotification(userId, notificationData) {
  notificationService.sendRealtimeNotification(userId, notificationData);
}

/**
 * Send real-time notification to multiple users (no database storage)
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data
 */
export function sendBulkRealtimeNotifications(userIds, notificationData) {
  notificationService.sendBulkRealtimeNotifications(userIds, notificationData);
}

/**
 * Notification event types for reference
 */
export const NOTIFICATION_EVENTS = {
  TASK_CREATED: 'task.created',
  MESSAGE_SENT: 'message.sent',
  TASK_ASSIGNED: 'task.assigned',
  TASK_STATUS_CHANGED: 'task.statusChanged',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated'
};
