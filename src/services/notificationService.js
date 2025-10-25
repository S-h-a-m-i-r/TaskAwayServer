import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Message from '../models/Message.js';

let io = null;
class NotificationService {
  static initialize(socketIO) {
    io = socketIO;
  }
  sendRealtimeNotification(userId, notificationData) {
    if (io) {
      io.to(`user_${userId}`).emit('newNotification', {
        id: notificationData._id || Date.now().toString(),
        message: notificationData.message,
        link: notificationData.link,
        sender: notificationData.sender,
        timestamp: new Date().toISOString(),
        seen: false
      });
      console.log(`📡 Real-time notification sent to user ${userId}`);
    }
  }

  /**
   * Send real-time notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notificationData - Notification data
   */
  sendBulkRealtimeNotifications(userIds, notificationData) {
    if (io && userIds.length > 0) {
      for (const userId of userIds) {
        this.sendRealtimeNotification(userId, notificationData);
      }
      console.log(`📡 Real-time notifications sent to ${userIds.length} users`);
    }
  }

  /**
   * Create a notification for a user (both DB and real-time)
   * @param {Object} notificationData - The notification data
   * @param {string} notificationData.recipient - User ID who receives the notification
   * @param {string} notificationData.sender - User ID who sent the notification (optional)
   * @param {string} notificationData.message - The notification message
   * @param {string} notificationData.link - Optional link for the notification
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(notificationData) {
    try {
      const notification = new Notification({
        recipient: notificationData.recipient,
        sender: notificationData.sender || null,
        message: notificationData.message,
        link: notificationData.link || null,
        seen: false
      });

      await notification.save();

      // Send real-time notification
      this.sendRealtimeNotification(notificationData.recipient, {
        _id: notification._id,
        message: notificationData.message,
        link: notificationData.link,
        sender: notificationData.sender
      });

      console.log(
        `✅ Notification created for user ${notificationData.recipient}: ${notificationData.message}`
      );
      return notification;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users (both DB and real-time)
   * @param {Array} recipients - Array of user IDs
   * @param {Object} notificationData - The notification data (without recipient)
   * @returns {Promise<Array>} Array of created notifications
   */
  async createBulkNotifications(recipients, notificationData) {
    try {
      const notifications = recipients.map((recipientId) => ({
        recipient: recipientId,
        sender: notificationData.sender || null,
        message: notificationData.message,
        link: notificationData.link || null,
        seen: false
      }));

      const createdNotifications = await Notification.insertMany(notifications);

      // Send real-time notifications to all recipients
      this.sendBulkRealtimeNotifications(recipients, {
        message: notificationData.message,
        link: notificationData.link,
        sender: notificationData.sender
      });

      console.log(
        `✅ Created ${createdNotifications.length} notifications for bulk recipients`
      );
      return createdNotifications;
    } catch (error) {
      console.error('❌ Error creating bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Get all admin users
   * @returns {Promise<Array>} Array of admin users
   */
  async getAdminUsers() {
    try {
      const adminUsers = await User.find({
        role: { $in: ['ADMIN'] }
      }).select('_id firstName lastName email');

      return adminUsers;
    } catch (error) {
      console.error('❌ Error fetching admin users:', error);
      throw error;
    }
  }

  /**
   * Get user details by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User details
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select(
        '_id firstName lastName email role'
      );
      return user;
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      throw error;
    }
  }

  /**
   * Get task details by ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task details
   */
  async getTaskById(taskId) {
    try {
      const task = await Task.findById(taskId)
        .populate('createdBy', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName email');
      return task;
    } catch (error) {
      console.error('❌ Error fetching task:', error);
      throw error;
    }
  }

  /**
   * Handle task creation notification
   * Notifies all admin users when a new task is created
   * @param {Object} data - Event data
   * @param {string} data.taskId - Task ID
   * @param {string} data.createdBy - User ID who created the task
   */
  async handleTaskCreated(data) {
    try {
      const { taskId, createdBy } = data;

      // Get task details
      const task = await this.getTaskById(taskId);
      if (!task) {
        console.warn(`⚠️ Task not found: ${taskId}`);
        return;
      }

      // Get creator details
      const creator = await this.getUserById(createdBy);
      if (!creator) {
        console.warn(`⚠️ Creator not found: ${createdBy}`);
        return;
      }

      // Get all admin users
      const adminUsers = await this.getAdminUsers();
      if (adminUsers.length === 0) {
        console.warn('⚠️ No admin users found');
        return;
      }

      // Create notification message
      const message = `New task "${task.title}" created by ${creator.firstName} ${creator.lastName}`;
      const link = `/admin/task/${taskId}`;

      // Create notifications for all admins (excluding the creator if they're an admin)
      const adminIds = adminUsers
        .map((admin) => admin._id.toString())
        .filter((adminId) => adminId !== createdBy);

      if (adminIds.length > 0) {
        await this.createBulkNotifications(adminIds, {
          sender: createdBy,
          message,
          link
        });
      }

      console.log(
        `✅ Task creation notifications sent to ${adminIds.length} admin users`
      );
    } catch (error) {
      console.error('❌ Error handling task created notification:', error);
    }
  }

  /**
   * Handle new message notification
   * Notifies the recipient when they receive a new message in a task chat
   * @param {Object} data - Event data
   * @param {string} data.taskId - Task ID
   * @param {string} data.senderId - User ID who sent the message
   * @param {string} data.messageId - Message ID
   */
  async handleNewMessage(data) {
    try {
      const { taskId, senderId, messageId } = data;

      // Get task details
      const task = await this.getTaskById(taskId);
      if (!task) {
        console.warn(`⚠️ Task not found: ${taskId}`);
        return;
      }

      // Get sender details
      const sender = await this.getUserById(senderId);
      if (!sender) {
        console.warn(`⚠️ Sender not found: ${senderId}`);
        return;
      }

      // Get message details
      const message = await Message.findById(messageId).populate(
        'senderId',
        'firstName lastName'
      );
      if (!message) {
        console.warn(`⚠️ Message not found: ${messageId}`);
        return;
      }
      // Determine who should be notified
      const recipients = [];

      console.log(
        'the task created by ',
        senderId,
        task?.createdBy._id,
        task?.assignedTo?._id
      );

      // Notify task creator if they're not the sender
      if (task.createdBy._id.toString() !== senderId.toString()) {
        recipients.push(task.createdBy._id.toString());
      }

      // Notify task assignee if they exist and are not the sender
      if (
        task.assignedTo &&
        task.assignedTo._id.toString() !== senderId.toString()
      ) {
        recipients.push(task.assignedTo._id.toString());
      }

      // Remove duplicates
      const uniqueRecipients = [...new Set(recipients)];

      if (uniqueRecipients.length > 0) {
        const notificationMessage = `New message in task "${task.title}" from ${sender.firstName} ${sender.lastName}`;
        const link = `/task/${taskId}`;
        await this.createBulkNotifications(uniqueRecipients, {
          sender: senderId,
          message: notificationMessage,
          link
        });

        console.log(
          `✅ Message notifications sent to ${uniqueRecipients.length} recipients`
        );
      }
    } catch (error) {
      console.error('❌ Error handling new message notification:', error);
    }
  }

  /**
   * Handle task assignment notification
   * Notifies user when they are assigned to a task
   * @param {Object} data - Event data
   * @param {string} data.taskId - Task ID
   * @param {string} data.assignedTo - User ID who was assigned
   * @param {string} data.assignedBy - User ID who made the assignment
   */
  async handleTaskAssigned(data) {
    try {
      const { taskId, assignedTo, assignedBy } = data;

      // Get task details
      const task = await this.getTaskById(taskId);
      if (!task) {
        console.warn(`⚠️ Task not found: ${taskId}`);
        return;
      }

      // Get assigner details
      const assigner = await this.getUserById(assignedBy);
      if (!assigner) {
        console.warn(`⚠️ Assigner not found: ${assignedBy}`);
        return;
      }

      const message = `You have been assigned to task "${task.title}" by ${assigner.firstName} ${assigner.lastName}`;
      const link = `/task/${taskId}`;

      await this.createNotification({
        recipient: assignedTo,
        sender: assignedBy,
        message,
        link
      });

      console.log(`✅ Task assignment notification sent to user ${assignedTo}`);
    } catch (error) {
      console.error('❌ Error handling task assignment notification:', error);
    }
  }

  /**
   * Handle task status change notification
   * Notifies relevant users when task status changes
   * @param {Object} data - Event data
   * @param {string} data.taskId - Task ID
   * @param {string} data.oldStatus - Previous status
   * @param {string} data.newStatus - New status
   * @param {string} data.changedBy - User ID who changed the status
   */
  async handleTaskStatusChanged(data) {
    try {
      const { taskId, oldStatus, newStatus, changedBy } = data;

      // Get task details
      const task = await this.getTaskById(taskId);
      if (!task) {
        console.warn(`⚠️ Task not found: ${taskId}`);
        return;
      }

      // Get changer details
      const changer = await this.getUserById(changedBy);
      if (!changer) {
        console.warn(`⚠️ Status changer not found: ${changedBy}`);
        return;
      }

      // Determine who should be notified
      const recipients = [];

      // Notify task creator if they're not the changer
      if (task.createdBy._id.toString() !== changedBy) {
        recipients.push(task.createdBy._id.toString());
      }

      // Notify task assignee if they exist and are not the changer
      if (task.assignedTo && task.assignedTo._id.toString() !== changedBy) {
        recipients.push(task.assignedTo._id.toString());
      }

      // Remove duplicates
      const uniqueRecipients = [...new Set(recipients)];

      if (uniqueRecipients.length > 0) {
        const message = `Task "${task.title}" status changed from ${oldStatus} to ${newStatus} by ${changer.firstName} ${changer.lastName}`;
        const link = `/task/${taskId}`;

        await this.createBulkNotifications(uniqueRecipients, {
          sender: changedBy,
          message,
          link
        });

        console.log(
          `✅ Task status change notifications sent to ${uniqueRecipients.length} recipients`
        );
      }
    } catch (error) {
      console.error(
        '❌ Error handling task status change notification:',
        error
      );
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Export both the class and the instance
export { NotificationService };
export default notificationService;
