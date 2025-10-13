import User from '../models/User.js';
import {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  deleteFileFromS3,
  isValidProfilePictureType,
  isValidFileSize
} from '../config/s3.js';
import AppError from '../utils/AppError.js';

// Generate pre-signed upload URL for profile picture (same pattern as file uploads)
export const generateProfilePictureUploadUrlService = async (
  fileName,
  fileType,
  fileSize,
  userId
) => {
  try {
    // Validate file type
    if (!isValidProfilePictureType(fileType)) {
      throw new AppError(
        'Invalid file type. Only PNG, JPG, and JPEG are allowed',
        400
      );
    }

    // Validate file size (5MB limit for profile pictures)
    if (!isValidFileSize(fileSize, 5 * 1024 * 1024)) {
      throw new AppError('File size exceeds 5MB limit', 400);
    }

    // Generate unique S3 key in temp folder (same as file uploads)
    const timestamp = Date.now();
    const s3Key = `temp/${timestamp}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Generate pre-signed PUT URL
    const presignedUrl = await generatePresignedPutUrl(s3Key, fileType, 3600); // 1 hour expiry

    return {
      success: true,
      uploadUrl: presignedUrl,
      fileKey: s3Key,
      message: 'Profile picture upload URL generated successfully'
    };
  } catch (error) {
    throw error;
  }
};

// Update user profile picture with S3 key (same pattern as file uploads)
export const updateUserProfilePictureService = async (userId, s3Key) => {
  try {
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Validate that the S3 key is in temp folder (security check)
    if (!s3Key.startsWith('temp/')) {
      throw new AppError(
        'Invalid file key. File must be uploaded through proper channels',
        400
      );
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      try {
        // Extract S3 key from old profile picture
        let oldS3Key = user.profilePicture;
        if (user.profilePicture.includes('amazonaws.com/')) {
          const urlParts = user.profilePicture.split('amazonaws.com/');
          oldS3Key = urlParts[1].split('?')[0]; // Remove query parameters
        }
        await deleteFileFromS3(oldS3Key);
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
        // Continue with update even if deletion fails
      }
    }

    // Store S3 key (not full URL) for security - presigned URLs will be generated when needed
    user.profilePicture = s3Key;
    await user.save();

    return {
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: s3Key
      }
    };
  } catch (error) {
    throw error;
  }
};

// Get profile picture download URL (generate presigned URL for security)
export const getProfilePictureDownloadUrlService = async (userId) => {
  try {
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.profilePicture) {
      throw new AppError('No profile picture found', 404);
    }

    // Extract S3 key from stored profile picture (handle both old and new formats)
    let s3Key = user.profilePicture;
    if (user.profilePicture.includes('amazonaws.com/')) {
      // Extract key from full URL: https://bucket.s3.region.amazonaws.com/key
      const urlParts = user.profilePicture.split('amazonaws.com/');
      s3Key = urlParts[1].split('?')[0]; // Remove query parameters
    }

    // Generate presigned URL for the S3 key
    const downloadUrl = await generatePresignedGetUrl(s3Key, 3600); // 1 hour expiry

    return {
      success: true,
      data: {
        downloadUrl: downloadUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        s3Key: s3Key
      }
    };
  } catch (error) {
    throw error;
  }
};

// Delete user profile picture
export const deleteUserProfilePictureService = async (userId) => {
  try {
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.profilePicture) {
      throw new AppError('No profile picture found', 404);
    }

    // Extract S3 key from stored profile picture
    let s3Key = user.profilePicture;
    if (user.profilePicture.includes('amazonaws.com/')) {
      const urlParts = user.profilePicture.split('amazonaws.com/');
      s3Key = urlParts[1].split('?')[0]; // Remove query parameters
    }

    // Delete from S3
    await deleteFileFromS3(s3Key);

    // Update user
    user.profilePicture = null;
    await user.save();

    return {
      success: true,
      message: 'Profile picture deleted successfully'
    };
  } catch (error) {
    throw error;
  }
};
