# Real-Time Notifications with Socket.IO

This guide explains how to implement real-time notifications in your TaskAway frontend using Socket.IO.

## Overview

The notification system now supports both:
1. **Database Storage**: Notifications are saved to the database for persistence
2. **Real-Time Delivery**: Active users receive notifications instantly via Socket.IO

## Socket.IO Events

### 1. Connection Setup

When a user connects, they automatically join their personal notification room:
```javascript
// User joins room: user_{userId}
socket.join(`user_${userId}`);
```

### 2. Real-Time Notification Event

**Event Name**: `newNotification`
**When**: A new notification is created for the user
**Payload**:
```javascript
{
  id: "notification_id",
  message: "New task 'Fix Bug' created by John Doe",
  link: "/admin/tasks/123",
  sender: "sender_user_id",
  timestamp: "2024-01-15T10:30:00.000Z",
  seen: false
}
```

## Frontend Implementation

### 1. Socket Connection Setup

```javascript
// In your Socket context or component
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  auth: {
    token: localStorage.getItem('token') // Your JWT token
  }
});

// Listen for new notifications
socket.on('newNotification', (notification) => {
  console.log('New notification received:', notification);
  
  // Add to your notification state/store
  addNotification(notification);
  
  // Show toast/alert
  showNotificationToast(notification);
  
  // Update notification badge
  updateNotificationBadge();
});
```

### 2. React Hook Example

```javascript
// useNotifications.js
import { useEffect, useState } from 'react';
import { useSocket } from './SocketContext';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Listen for new notifications
    const handleNewNotification = (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('TaskAway', {
          body: notification.message,
          icon: '/logo.png'
        });
      }
    };

    socket.on('newNotification', handleNewNotification);

    return () => {
      socket.off('newNotification', handleNewNotification);
    };
  }, [socket]);

  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, seen: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return {
    notifications,
    unreadCount,
    markAsRead
  };
};
```

### 3. Notification Component Example

```javascript
// NotificationBell.jsx
import React, { useState } from 'react';
import { useNotifications } from './useNotifications';

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Navigate to the link if provided
    if (notification.link) {
      window.location.href = notification.link;
    }
    
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Notification Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12.828 7H4.828z" />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    !notification.seen ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notification.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
```

### 4. Toast Notification Example

```javascript
// NotificationToast.jsx
import React, { useEffect, useState } from 'react';
import { useNotifications } from './useNotifications';

const NotificationToast = () => {
  const { notifications } = useNotifications();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      
      // Show toast for latest notification
      setToast(latestNotification);
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notifications]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 max-w-sm">
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{toast.message}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(toast.timestamp).toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setToast(null)}
          className="ml-2 text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
```

## Notification Types

### 1. Task Created Notifications
- **Recipients**: All admin users
- **Message**: "New task 'Task Title' created by User Name"
- **Link**: `/admin/tasks/{taskId}`

### 2. Message Notifications
- **Recipients**: Task creator and assignee (excluding sender)
- **Message**: "New message in task 'Task Title' from User Name"
- **Link**: `/tasks/{taskId}`

### 3. Task Assignment Notifications
- **Recipients**: Assigned user
- **Message**: "You have been assigned to task 'Task Title' by User Name"
- **Link**: `/tasks/{taskId}`

### 4. Task Status Change Notifications
- **Recipients**: Task creator and assignee (excluding changer)
- **Message**: "Task 'Task Title' status changed from OldStatus to NewStatus by User Name"
- **Link**: `/tasks/{taskId}`

## Browser Notifications

To show browser notifications, request permission:

```javascript
// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Show browser notification
if (Notification.permission === 'granted') {
  new Notification('TaskAway', {
    body: notification.message,
    icon: '/logo.png',
    tag: notification.id // Prevents duplicate notifications
  });
}
```

## Testing Real-Time Notifications

1. **Open two browser windows** with different users logged in
2. **Create a task** as a regular user - admin should get notification
3. **Send a message** in task chat - other user should get notification
4. **Assign a task** - assigned user should get notification
5. **Change task status** - relevant users should get notifications

## Error Handling

```javascript
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
  // Handle connection errors
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
  // Handle disconnection
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Handle socket errors
});
```

## Performance Considerations

1. **Limit notification history** in frontend state
2. **Debounce rapid notifications** to avoid spam
3. **Use pagination** for notification lists
4. **Implement notification cleanup** for old notifications

## Security Notes

1. **Authentication required** for Socket.IO connection
2. **User-specific rooms** prevent cross-user notifications
3. **Server-side validation** of all notification data
4. **Rate limiting** on notification creation

This real-time notification system provides instant feedback to users and enhances the overall user experience of your TaskAway application!
