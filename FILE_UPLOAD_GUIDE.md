# File Upload System Guide

This guide explains how to use the file upload system for tasks using AWS S3 pre-signed URLs.

## Overview

The system implements a two-step file upload process:
1. **Step 1**: Create task and get taskId
2. **Step 2**: Upload files using pre-signed URLs

## Environment Variables

Add these to your `.env` file:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID_ID=your_AWS_ACCESS_KEY_ID_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=eu-north-1
AWS_BUCKET_NAME=your_s3_bucket_name
```

## API Endpoints

### 1. Create Task (Step 1)
```http
POST /tasks/createTask
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Task Title",
  "description": "Task Description",
  "status": "Submitted"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "64f8a1b2c3d4e5f6a7b8c9d0"
  }
}
```

### 2. Generate Upload URL (Step 2a)
```http
POST /files/upload-url
Authorization: Bearer <token>
Content-Type: application/json

{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1048576
}
```

**Response:**
```json
{
  "success": true,
  "uploadUrl": "https://presigned-s3-url...",
  "fileKey": "temp/1234567890-document.pdf",
  "message": "Upload URL generated successfully"
}
```

### 3. Upload File to S3 (Frontend)
```javascript
// Frontend code to upload file directly to S3
const uploadFile = async (file, uploadUrl) => {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });
    
    if (response.ok) {
      console.log('File uploaded successfully to S3');
      return true;
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return false;
  }
};
```

### 4. Attach Files to Task (Step 2b)
```http
POST /files/64f8a1b2c3d4e5f6a7b8c9d0/files
Authorization: Bearer <token>
Content-Type: application/json

{
  "files": [
    {
      "fileName": "document.pdf",
      "fileType": "application/pdf",
      "fileSize": 1048576,
      "fileKey": "temp/1234567890-document.pdf"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "1 file(s) attached successfully"
}
```

### 5. Get Task Files
```http
GET /files/64f8a1b2c3d4e5f6a7b8c9d0/files
Authorization: Bearer <token>
```

### 6. Get File Download URL
```http
GET /files/download/temp/1234567890-document.pdf
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://presigned-download-url...",
  "message": "Download URL generated successfully"
}
```

### 7. Remove File from Task
```http
DELETE /files/64f8a1b2c3d4e5f6a7b8c9d0/files/temp/1234567890-document.pdf
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "File removed successfully"
}
```

## File Validation

### Supported File Types
- PDF: `application/pdf`
- Images: `image/jpeg`, `image/png`, `image/gif`
- Text: `text/plain`
- Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Excel: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### File Size Limits
- **Individual file**: Maximum 10MB
- **Total per task**: Maximum 60MB
- **File count**: Maximum 12 files per task

## Security Features

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only access files for tasks they created or are assigned to
3. **Pre-signed URLs**: URLs expire after 1 hour
4. **File validation**: File type and size validation on both frontend and backend
5. **S3 key sanitization**: Filenames are sanitized to prevent path traversal attacks

## Error Handling

Common error responses:

```json
{
  "success": false,
  "message": "Error message",
  "status": 400
}
```

### Common Errors
- `400`: Invalid file type/size, missing fields
- `403`: Unauthorized access to task
- `404`: Task or file not found
- `413`: File size too large
- `500`: Internal server error

## Frontend Implementation Example

```javascript
class TaskFileUploader {
  constructor(taskId, authToken) {
    this.taskId = taskId;
    this.authToken = authToken;
    this.baseUrl = 'http://localhost:3000';
  }

  async uploadFile(file) {
    try {
      // Step 1: Get upload URL
      const uploadUrlResponse = await this.getUploadUrl(file);
      if (!uploadUrlResponse.success) {
        throw new Error(uploadUrlResponse.message);
      }

      const { uploadUrl, fileKey } = uploadUrlResponse;

      // Step 2: Upload to S3
      const uploadSuccess = await this.uploadToS3(file, uploadUrl);
      if (!uploadSuccess) {
        throw new Error('Failed to upload file to S3');
      }

      // Step 3: Attach file to task
      const attachResponse = await this.attachFileToTask(fileKey, file);
      if (!attachResponse.success) {
        throw new Error(attachResponse.message);
      }

      return attachResponse;
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  async getUploadUrl(file) {
    const response = await fetch(`${this.baseUrl}/files/upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      })
    });

    return await response.json();
  }

  async uploadToS3(file, uploadUrl) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });

    return response.ok;
  }

  async attachFileToTask(fileKey, file) {
    const response = await fetch(`${this.baseUrl}/files/${this.taskId}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: [{
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileKey: fileKey
        }]
      })
    });

    return await response.json();
  }
}
```

// Usage
const uploader = new TaskFileUploader(taskId, authToken);
const fileInput = document.getElementById('fileInput');

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      const result = await uploader.uploadFile(file);
      console.log('File uploaded successfully:', result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
});
```

## Testing

You can test the endpoints using tools like Postman or curl:

```bash
# Test upload URL generation
curl -X POST http://localhost:3000/files/upload-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024
  }'
```

## Troubleshooting

1. **AWS Credentials**: Ensure your AWS credentials are correct and have S3 permissions
2. **Bucket Policy**: Make sure your S3 bucket allows PUT operations
3. **CORS**: Configure CORS on your S3 bucket if uploading from a different domain
4. **File Size**: Check that files don't exceed size limits
5. **Token Expiry**: Ensure JWT tokens are valid and not expired
