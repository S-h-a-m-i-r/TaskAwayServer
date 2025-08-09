import express from 'express';
import { authorizeRoles, authenticateToken } from '../middleware/auth.js';
import { validateTask } from '../middleware/validateTask.js';
import { create, viewTask, assignTask,reAssignTask, updateTask, deleteTask, listTasks } from '../controllers/tasksController.js';
import Task from '../models/Task.js';

const router = express.Router();
router.post(
  '/createTask',
  authenticateToken,
  validateTask,
  authorizeRoles('CUSTOMER', 'ADMIN'),
  create
);

router.get(
  '/viewTask/:taskId',
  authenticateToken,
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  viewTask
);

router.patch(
  '/:taskId/assign',
  authenticateToken,
  authorizeRoles('BASIC', 'MANAGER', 'ADMIN'),
  assignTask
);

router.patch('/:taskId/reassign',
  authenticateToken,
  authorizeRoles('MANAGER', 'ADMIN'),
  reAssignTask
);

router.put(
  '/updateTask/:taskId',
  authenticateToken,
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  updateTask
);

router.delete(
  '/deleteTask/:taskId',
  authenticateToken,
  authorizeRoles( 'MANAGER', 'ADMIN'),
  deleteTask
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  listTasks
);

// Debug endpoint to check status values
router.get(
  '/debug/status',
  authenticateToken,
  async (req, res) => {
    try {
      const tasks = await Task.find({}).select('status title').limit(5);
      res.json({
        success: true,
        message: 'Status values from database',
        tasks: tasks.map(task => ({
          id: task._id,
          title: task.title,
          status: task.status,
          statusType: typeof task.status,
          statusLength: task.status.length
        })),
        validStatuses: ['Submitted', 'InProgress', 'Completed', 'Closed']
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default router;
