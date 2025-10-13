import Task from '../models/Task.js';
import {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  deleteFileFromS3,
  isValidFileType,
  isValidFileSize
} from '../config/s3.js';
import AppError from '../utils/AppError.js';

// Generate pre-signed upload URL for a file
export const generateUploadUrlService = async (
  fileName,
  fileType,
  fileSize,
  userId
) => {
  try {
    // Validate file type
    if (!isValidFileType(fileType)) {
      throw new AppError('Invalid file type', 400);
    }

    // Validate file size
    if (!isValidFileSize(fileSize)) {
      throw new AppError('File size exceeds 10MB limit', 400);
    }

    // Generate unique S3 key (without taskId for now)
    const timestamp = Date.now();
    const s3Key = `temp/${timestamp}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Generate pre-signed PUT URL
    const presignedUrl = await generatePresignedPutUrl(s3Key, fileType, 3600); // 1 hour expiry

    return {
      success: true,
      uploadUrl: presignedUrl,
      fileKey: s3Key,
      message: 'Upload URL generated successfully'
    };
  } catch (error) {
    throw error;
  }
};

// Attach uploaded files to task
export const attachFilesToTaskService = async (taskId, files, userId) => {
  try {
    // Validate task exists and user has access
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if user has permission to upload files to this task
    if (
      task.createdBy.toString() !== userId &&
      task.assignedTo?.toString() !== userId
    ) {
      throw new AppError('Unauthorized to upload files to this task', 403);
    }

    // Check if task already has maximum files
    if (task.files && task.files.length + files.length > 12) {
      throw new AppError('Task would exceed maximum number of files (12)', 400);
    }

    // Check total file size limit (60MB)
    const currentTotalSize = task.files
      ? task.files.reduce((acc, file) => acc + file.size, 0)
      : 0;
    const newFilesTotalSize = files.reduce(
      (acc, file) => acc + file.fileSize,
      0
    );
    if (currentTotalSize + newFilesTotalSize > 60 * 1024 * 1024) {
      throw new AppError('Total file size would exceed 60MB limit', 400);
    }

    // Initialize files array if it doesn't exist
    if (!task.files) {
      task.files = [];
    }

    // Process each file
    for (const fileData of files) {
      const { fileName, fileSize, fileType, fileKey } = fileData;

      // Create file object with S3 key (presigned URLs will be generated when needed)
      const fileObject = {
        filename: fileName,
        url: fileKey, // Store S3 key instead of direct URL for security
        size: fileSize,
        type: fileType,
        fileKey: fileKey,
        uploadedAt: new Date()
      };

      console.log('📁 Creating file object:', {
        filename: fileName,
        fileKey: fileKey,
        size: fileSize,
        type: fileType
      });

      // Check if file with same key already exists
      const existingFileIndex = task.files.findIndex(
        (file) => file.fileKey === fileKey
      );
      if (existingFileIndex !== -1) {
        // Update existing file
        console.log('🔄 Updating existing file with key:', fileKey);
        task.files[existingFileIndex] = fileObject;
      } else {
        // Add new file
        console.log('➕ Adding new file with key:', fileKey);
        task.files.push(fileObject);
      }
    }

    await task.save();

    // Log what was saved for debugging
    console.log(
      '💾 Task saved. Files in database:',
      task.files.map((f) => ({
        filename: f.filename,
        fileKey: f.fileKey,
        size: f.size,
        type: f.type
      }))
    );

    return {
      success: true,
      message: `${files.length} file(s) attached successfully`
    };
  } catch (error) {
    throw error;
  }
};

// Get file download URL by fileKey
export const getFileDownloadUrlByKeyService = async (fileKey, userId) => {
  try {
    const actualKey = `temp/${fileKey}`;
    // Generate pre-signed download URL
    const downloadUrl = await generatePresignedGetUrl(actualKey, 3600); // 1 hour expiry

    return {
      success: true,
      downloadUrl: downloadUrl,
      message: 'Download URL generated successfully'
    };
  } catch (error) {
    throw error;
  }
};

// Get file download URL by fileId (for backward compatibility)
export const getFileDownloadUrlService = async (taskId, fileId, userId) => {
  try {
    // Validate task exists and user has access
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if user has permission to download files from this task
    if (task.createdBy.toString() !== userId && task.assignedTo?.toString() !== userId) {
      throw new AppError('Unauthorized to download files from this task', 403);
    }

    // Find the file
    const file = task.files.id(fileId);
    if (!file) {
      throw new AppError('File not found', 404);
    }

    // Use fileKey directly if available, otherwise extract from URL
    let s3Key = file.fileKey || (() => {
      const urlParts = file.url.split('/');
      return urlParts.slice(3).join('/'); // Remove protocol, bucket, and region
    })();

    // Ensure s3Key has temp/ prefix for S3 operations
    if (!s3Key.startsWith('temp/')) {
      s3Key = `temp/${s3Key}`;
    }

    // Generate pre-signed download URL
    const downloadUrl = await generatePresignedGetUrl(s3Key, 3600); // 1 hour expiry

    return {
      success: true,
      data: {
        downloadUrl: downloadUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        file: file
      }
    };
  } catch (error) {
    throw error;
  }
};

// Remove file from task by fileKey
export const removeFileFromTaskByKeyService = async (taskId, fileKey, userId) => {
  try {
    const actualKey = `temp/${fileKey}`;
    // Validate task exists and user has access
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if user has permission to delete files from this task
    if (task.createdBy.toString() !== userId && task.assignedTo?.toString() !== userId) {
      throw new AppError('Unauthorized to delete files from this task', 403);
    }

    // Find the file by fileKey (with or without temp/ prefix)
    const fileIndex = task.files.findIndex(file => {
      // Check if fileKey matches exactly
      if (file.fileKey === fileKey) return true;
      // Check if fileKey matches with temp/ prefix
      if (file.fileKey === `temp/${fileKey}`) return true;
      // Check if fileKey matches without temp/ prefix
      if (file.fileKey === fileKey.replace('temp/', '')) return true;
      return false;
    });
    
    if (fileIndex === -1) {
      throw new AppError('File not found', 404);
    }

    // Delete from S3
    await deleteFileFromS3(actualKey);

    // Remove from task
    task.files.splice(fileIndex, 1);
    await task.save();

    return {
      success: true,
      message: 'File removed successfully'
    };
  } catch (error) {
    throw error;
  }
};

// Delete file from task by fileId (for backward compatibility)
export const deleteFileFromTaskService = async (taskId, fileId, userId) => {
  try {
    // Validate task exists and user has access
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if user has permission to delete files from this task
    if (task.createdBy.toString() !== userId && task.assignedTo?.toString() !== userId) {
      throw new AppError('Unauthorized to delete files from this task', 403);
    }

    // Find the file
    const file = task.files.id(fileId);
    if (!file) {
      throw new AppError('File not found', 404);
    }

    // Use fileKey directly if available, otherwise extract from URL
    let s3Key = file.fileKey || (() => {
      const urlParts = file.url.split('/');
      return urlParts.slice(3).join('/'); // Remove protocol, bucket, and region
    })();

    // Ensure s3Key has temp/ prefix for S3 deletion
    if (!s3Key.startsWith('temp/')) {
      s3Key = `temp/${s3Key}`;
    }

    // Delete from S3
    await deleteFileFromS3(s3Key);

    // Remove from task
    task.files.pull(fileId);
    await task.save();

    return {
      success: true,
      data: {
        message: 'File deleted successfully',
        totalFiles: task.files.length
      }
    };
  } catch (error) {
    throw error;
  }
};

// Get all files for a task
export const getTaskFilesService = async (taskId, userId) => {
  try {
    // Validate task exists and user has access
    const task = await Task.findById(taskId).select('files createdBy assignedTo');
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if user has permission to view files from this task
    if (task.createdBy.toString() !== userId && task.assignedTo?.toString() !== userId) {
      throw new AppError('Unauthorized to view files from this task', 403);
    }

    return {
      success: true,
      data: {
        files: task.files || [],
        totalFiles: task.files ? task.files.length : 0
      }
    };
  } catch (error) {
    throw error;
  }
};
