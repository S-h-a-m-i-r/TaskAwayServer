import {
  generateUploadUrlService,
  attachFilesToTaskService,
  getFileDownloadUrlByKeyService,
  removeFileFromTaskByKeyService,
  getTaskFilesService
} from '../services/fileService.js';
import  AppError  from '../utils/AppError.js';

// Generate pre-signed upload URL
export const generateUploadUrl = async (req, res, next) => {
  try {
    const { fileName, fileType, fileSize } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!fileName || !fileType || !fileSize) {
      throw new AppError('Missing required fields: fileName, fileType, fileSize', 400);
    }

    // Validate fileSize is a number
    if (isNaN(fileSize) || fileSize <= 0) {
      throw new AppError('Invalid file size', 400);
    }

    const result = await generateUploadUrlService(fileName, fileType, parseInt(fileSize), userId);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Attach uploaded files to task
export const attachFilesToTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { files } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new AppError('Missing required field: files array', 400);
    }

    // Validate each file has required fields
    for (const file of files) {
      if (!file.fileName || !file.fileType || !file.fileSize || !file.fileKey) {
        throw new AppError('Each file must have fileName, fileType, fileSize, and fileKey', 400);
      }
    }

    const result = await attachFilesToTaskService(taskId, files, userId);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get file download URL by fileKey
export const getFileDownloadUrlByKey = async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    const userId = req.user.id;

    const result = await getFileDownloadUrlByKeyService(fileKey, userId);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Remove file from task by fileKey
export const removeFileFromTaskByKey = async (req, res, next) => {
  try {
    const { taskId, fileKey } = req.params;
    const userId = req.user.id;

    const result = await removeFileFromTaskByKeyService(taskId, fileKey, userId);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get all files for a task
export const getTaskFiles = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const result = await getTaskFilesService(taskId, userId);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
