import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  generateUploadUrl,
  attachFilesToTask,
  getFileDownloadUrlByKey,
  removeFileFromTaskByKey,
  getTaskFiles
} from '../controllers/fileController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Generate pre-signed upload URL
router.post('/upload-url', 
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  generateUploadUrl
);

// Attach uploaded files to task
router.post('/:taskId/files',
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  attachFilesToTask
);

// Get all files for a task
router.get('/:taskId/files',
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  getTaskFiles
);

// Get file download URL by fileKey
router.get('/download/:fileKey',
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  getFileDownloadUrlByKey
);

// Remove file from task by fileKey
router.delete('/:taskId/files/:fileKey',
  authorizeRoles('CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'),
  removeFileFromTaskByKey
);

export default router;
