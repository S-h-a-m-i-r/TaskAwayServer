import Notification from '../models/Notification.js';
import AppError from '../utils/AppError.js';

/**
 * Get user notifications from last 48 hours in descending order
 * GET /api/notifications
 */
export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    // Calculate date 48 hours ago
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    // Find notifications for the user from last 48 hours
    const notifications = await Notification.find({
      recipient: userId,
      createdAt: { $gte: fortyEightHoursAgo }
    })
      .populate('sender', 'firstName lastName email')
      .sort({ createdAt: -1 }) // Descending order (newest first)
      .lean(); // Use lean() for better performance
    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    next(new AppError('Failed to fetch notifications', 500));
  }
};

/**
 * Mark a specific notification as read
 * PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find and update the notification
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: userId, // Ensure user can only update their own notifications
        seen: false // Only update if not already seen
      },
      { seen: true },
      { new: true }
    );

    if (!notification) {
      return next(
        new AppError('Notification not found or already marked as read', 404)
      );
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    next(new AppError('Failed to mark notification as read', 500));
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/mark-all-read
 * Body: { notificationIds: [array of notification IDs] }
 */
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { notificationIds } = req.body;
    // Validate that notificationIds is provided and is an array
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return next(new AppError('notificationIds array is required', 400));
    }

    if (notificationIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No notifications to mark as read',
        updatedCount: 0
      });
    }

    // Update all specified notifications for the user
    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        recipient: userId, // Ensure user can only update their own notifications
        seen: false // Only update unread notifications
      },
      { seen: true }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    next(new AppError('Failed to mark notifications as read', 500));
  }
};

/**
 * Delete a specific notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find and delete the notification
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: userId // Ensure user can only delete their own notifications
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    next(new AppError('Failed to delete notification', 500));
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      seen: false
    });

    res.status(200).json({
      success: true,
      data: { count: unreadCount }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    next(new AppError('Failed to fetch unread count', 500));
  }
};
