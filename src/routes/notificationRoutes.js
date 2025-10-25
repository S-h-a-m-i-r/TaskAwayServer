import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

// GET /api/notifications - Get user notifications (last 48 hours, desc order)
router.get('/', getNotifications);

// PATCH /api/notifications/:id/read - Mark specific notification as read
router.patch('/:id/read', markNotificationAsRead);

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', markAllNotificationsAsRead);

// DELETE /api/notifications/:id - Delete specific notification
router.delete('/:id', deleteNotification);

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', getUnreadCount);

export default router;
