# Notification API Documentation

This document describes the notification API endpoints for the TaskAway application.

## Base URL
```
/api/notifications
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get User Notifications
**GET** `/api/notifications`

Returns notifications for the authenticated user from the last 48 hours in descending order (newest first).

#### Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "notification_id",
      "recipient": "user_id",
      "sender": {
        "_id": "sender_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "message": "New task 'Fix Bug' created by John Doe",
      "link": "/admin/tasks/123",
      "seen": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 5
}
```

#### Features
- Only returns notifications from last 48 hours
- Sorted by creation date (newest first)
- Populates sender information
- Includes seen status for frontend state management

---

### 2. Mark Notification as Read
**PATCH** `/api/notifications/:id/read`

Marks a specific notification as read.

#### Parameters
- `id` (string): Notification ID

#### Response
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "_id": "notification_id",
    "recipient": "user_id",
    "sender": "sender_id",
    "message": "New task 'Fix Bug' created by John Doe",
    "link": "/admin/tasks/123",
    "seen": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- `404`: Notification not found or already marked as read
- `500`: Server error

---

### 3. Mark All Notifications as Read
**PATCH** `/api/notifications/mark-all-read`

Marks multiple notifications as read. Frontend sends array of unread notification IDs.

#### Request Body
```json
{
  "notificationIds": [
    "notification_id_1",
    "notification_id_2",
    "notification_id_3"
  ]
}
```

#### Response
```json
{
  "success": true,
  "message": "3 notifications marked as read",
  "updatedCount": 3
}
```

#### Features
- Only updates notifications that belong to the authenticated user
- Only updates notifications that are currently unread
- Returns count of actually updated notifications
- Optimistic updates on frontend with rollback on error

---

### 4. Delete Notification
**DELETE** `/api/notifications/:id`

Deletes a specific notification.

#### Parameters
- `id` (string): Notification ID

#### Response
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

#### Error Responses
- `404`: Notification not found
- `500`: Server error

---

### 5. Get Unread Count
**GET** `/api/notifications/unread-count`

Returns the count of unread notifications for the authenticated user.

#### Response
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

## Frontend Integration

### State Management Flow

1. **Fetch Notifications**: Call `GET /api/notifications` on app load
2. **Display Notifications**: Show notifications with read/unread status
3. **Mark as Read**: Call `PATCH /api/notifications/:id/read` when user clicks notification
4. **Mark All as Read**: Call `PATCH /api/notifications/mark-all-read` with array of unread IDs
5. **Real-time Updates**: Listen for Socket.IO `newNotification` events

### Optimistic Updates

The frontend implements optimistic updates for better UX:

```typescript
// Mark single notification as read
const markAsRead = async (notificationId: string) => {
  // 1. Optimistically update UI
  setNotifications(prev => 
    prev.map(n => n._id === notificationId ? { ...n, seen: true } : n)
  );
  
  // 2. Call API
  try {
    await notificationService.markAsRead(notificationId);
  } catch (error) {
    // 3. Revert on error
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, seen: false } : n)
    );
  }
};

// Mark all notifications as read
const markAllAsRead = async () => {
  const unreadIds = notifications.filter(n => !n.seen).map(n => n._id);
  
  // 1. Optimistically update UI
  setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
  
  // 2. Call API with notification IDs
  try {
    await notificationService.markAllAsRead(unreadIds);
  } catch (error) {
    // 3. Revert on error
    setNotifications(prev => 
      prev.map(n => unreadIds.includes(n._id) ? { ...n, seen: false } : n)
    );
  }
};
```

### Real-time Integration

```typescript
// Listen for new notifications via Socket.IO
socket.on('newNotification', (notification) => {
  // Add to frontend state
  addNotification(notification);
  
  // Show toast notification
  showToast(notification.message);
  
  // Show browser notification
  if (Notification.permission === 'granted') {
    new Notification('TaskAway', {
      body: notification.message,
      icon: '/logo.png'
    });
  }
});
```

## Error Handling

### Common Error Responses

```json
// 400 Bad Request
{
  "success": false,
  "message": "notificationIds array is required",
  "statusCode": 400
}

// 401 Unauthorized
{
  "success": false,
  "message": "Access denied. No token provided.",
  "statusCode": 401
}

// 404 Not Found
{
  "success": false,
  "message": "Notification not found",
  "statusCode": 404
}

// 500 Internal Server Error
{
  "success": false,
  "message": "Failed to fetch notifications",
  "statusCode": 500
}
```

### Frontend Error Handling

```typescript
try {
  const notifications = await notificationService.getNotifications();
  setNotifications(notifications);
} catch (error) {
  if (error.status === 401) {
    // Redirect to login
    navigate('/login');
  } else {
    // Show error message
    setError('Failed to load notifications');
  }
}
```

## Security Features

1. **User Isolation**: Users can only access their own notifications
2. **Authentication Required**: All endpoints require valid JWT token
3. **Input Validation**: Notification IDs are validated
4. **Rate Limiting**: Consider implementing rate limiting for production
5. **Data Sanitization**: All inputs are sanitized

## Performance Considerations

1. **48-Hour Limit**: Only fetches recent notifications to improve performance
2. **Lean Queries**: Uses MongoDB lean() for better performance
3. **Indexing**: Ensure proper indexes on recipient and createdAt fields
4. **Pagination**: Consider adding pagination for large notification lists

## Database Indexes

Recommended MongoDB indexes for optimal performance:

```javascript
// Compound index for efficient querying
db.notifications.createIndex({ "recipient": 1, "createdAt": -1 })

// Index for unread count queries
db.notifications.createIndex({ "recipient": 1, "seen": 1 })
```

## Testing

### Test Cases

1. **Get Notifications**:
   - Valid user with notifications
   - User with no notifications
   - Invalid authentication

2. **Mark as Read**:
   - Valid notification ID
   - Already read notification
   - Non-existent notification
   - Other user's notification

3. **Mark All as Read**:
   - Multiple unread notifications
   - Empty notification IDs array
   - Mix of valid and invalid IDs

4. **Delete Notification**:
   - Valid notification ID
   - Non-existent notification
   - Other user's notification

### Example Test Data

```javascript
// Sample notification for testing
{
  "_id": "507f1f77bcf86cd799439011",
  "recipient": "507f1f77bcf86cd799439012",
  "sender": "507f1f77bcf86cd799439013",
  "message": "New task 'Fix Bug' created by John Doe",
  "link": "/admin/tasks/507f1f77bcf86cd799439014",
  "seen": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

This API provides a complete notification system with real-time updates, optimistic UI updates, and proper error handling for a production-ready application.
