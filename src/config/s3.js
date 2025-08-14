import dotenv from 'dotenv';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error('AWS_ACCESS_KEY_ID environment variable is required');
}
if (!process.env.AWS_SECRET_KEY_ID) {
  throw new Error('AWS_SECRET_ACCESS_KEY environment variable is required');
}
if (!process.env.AWS_BUCKET_NAME) {
  throw new Error('AWS_BUCKET_NAME environment variable is required');
}

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY_ID,
  },
});

// S3 bucket name
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Debug: Log environment variables (remove in production)
console.log('S3 Config Debug:', {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_ID ? '***SET***' : 'MISSING',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? '***SET***' : 'MISSING',
  bucketName: BUCKET_NAME || 'MISSING'
});

// Generate pre-signed PUT URL for file upload
export const generatePresignedPutUrl = async (key, contentType, expiresIn = 3600) => {
  try {
    // Validate BUCKET_NAME is set
    if (!BUCKET_NAME) {
      throw new Error('AWS_BUCKET_NAME environment variable is not set');
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    console.log('Generating presigned URL for:', { bucket: BUCKET_NAME, key, contentType });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    console.log('Presigned URL generated successfully');
    
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned PUT URL:', error);
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }
};

// Generate pre-signed GET URL for file download
export const generatePresignedGetUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned GET URL:', error);
    throw new Error('Failed to generate download URL');
  }
};

// Delete file from S3
export const deleteFileFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
};

// Generate unique S3 key for file
export const generateS3Key = (taskId, filename, timestamp) => {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `tasks/${taskId}/${timestamp}-${sanitizedFilename}`;
};

// Validate file type
export const isValidFileType = (mimetype) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/webp',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  return allowedTypes.includes(mimetype);
};

// Validate file size (in bytes)
export const isValidFileSize = (size) => {
  const maxSize = 10 * 1024 * 1024; // 10MB per file
  return size <= maxSize;
};

// Test S3 connection
export const testS3Connection = async () => {
  try {
    // Try to list objects in the bucket (this will test credentials and permissions)
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'test-connection.txt'
    });
    
    // This will fail with a "NoSuchKey" error, but that's expected and means credentials work
    await s3Client.send(command);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      console.log('✅ S3 connection test successful - credentials are valid');
      return true;
    } else if (error.name === 'AccessDenied' || error.name === 'InvalidAccessKeyId') {
      console.error('❌ S3 connection failed - invalid credentials or permissions');
      throw new Error('Invalid AWS credentials or insufficient permissions');
    } else {
      console.error('❌ S3 connection failed:', error.message);
      throw error;
    }
  }
};

export { s3Client, BUCKET_NAME };
