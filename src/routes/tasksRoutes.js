import express from 'express';
import { authorizeRoles, authenticateToken } from '../middleware/auth.js';
import { validateTask } from '../middleware/validateTask.js';
import { create, viewTask, assignTask,reAssignTask, updateTask, deleteTask, listTasks } from '../controllers/tasksController.js';

const router = express.Router();
router.post(
  '/createTask',
  authenticateToken,
  validateTask,
  authorizeRoles('CUSTOMER'),
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
export default router;
