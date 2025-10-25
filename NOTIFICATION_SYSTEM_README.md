# TaskAway Notification System

This document explains how to use the notification event system in TaskAway. The system is built on Node.js EventEmitter and provides a clean way to send notifications for various events throughout the application.

## Overview

The notification system consists of:
- **Event Emitter**: Central event system for emitting and listening to events
- **Notification Service**: Handles creating and managing notifications in the database
- **Utility Functions**: Easy-to-use helper functions for emitting events
- **Event Listeners**: Automatically handle events and create notifications

## Architecture

```
Event Trigger → Event Emitter → Event Listener → Notification Service → Database
```

## Available Events

### 1. Task Created (`task.created`)
**When**: A new task is created
**Payload**:
```javascript
{
  taskId: "task_id_here",
  createdBy: "user_id_here"
}
```
**Recipients**: All admin users (excluding the creator if they're an admin)

### 2. New Message (`message.sent`)
**When**: A new message is sent in a task chat
**Payload**:
```javascript
{
  taskId: "task_id_here",
  senderId: "user_id_here",
  messageId: "message_id_here"
}
```
**Recipients**: Task creator and assignee (excluding the sender)

### 3. Task Assigned (`task.assigned`)
**When**: A task is assigned to a user
**Payload**:
```javascript
{
  taskId: "task_id_here",
  assignedTo: "user_id_here",
  assignedBy: "user_id_here"
}
```
**Recipients**: The user who was assigned

### 4. Task Status Changed (`task.statusChanged`)
**When**: A task's status is updated
**Payload**:
```javascript
{
  taskId: "task_id_here",
  oldStatus: "InProgress",
  newStatus: "Completed",
  changedBy: "user_id_here"
}
```
**Recipients**: Task creator and assignee (excluding the user who changed the status)

## How to Use

### Method 1: Using Utility Functions (Recommended)

```javascript
import { 
  notifyTaskCreated, 
  notifyNewMessage, 
  notifyTaskAssigned, 
  notifyTaskStatusChanged 
} from '../utils/notificationUtils.js';

// When creating a task
notifyTaskCreated(taskId, createdBy);

// When sending a message
notifyNewMessage(taskId, senderId, messageId);

// When assigning a task
notifyTaskAssigned(taskId, assignedTo, assignedBy);

// When changing task status
notifyTaskStatusChanged(taskId, oldStatus, newStatus, changedBy);
```

### Method 2: Direct Event Emitter

```javascript
import eventEmitter from '../services/eventService.js';

// Emit any notification event
eventEmitter.emit('task.created', {
  taskId: 'task_id_here',
  createdBy: 'user_id_here'
});
```

### Method 3: Custom Events

```javascript
import { emitCustomNotification } from '../utils/notificationUtils.js';

// Emit custom notification event
emitCustomNotification('custom.event', {
  customData: 'value'
});
```

## Integration Examples

### In Task Creation Service

```javascript
// In tasksService.js
import eventEmitter from './eventService.js';

export async function createTaskService(taskData, user) {
  // ... task creation logic ...
  
  const task = new Task(taskData);
  await task.save();
  
  // Emit notification event
  eventEmitter.emit('task.created', {
    taskId: task._id,
    createdBy: user._id
  });
  
  return { success: true, task };
}
```

### In Socket.IO Message Handler

```javascript
// In server.js
import eventEmitter from './src/services/eventService.js';

socket.on('sendMessage', async ({ taskId, content }) => {
  // ... message saving logic ...
  
  const message = new Message({
    taskId,
    senderId: socket.user._id,
    content
  });
  await message.save();
  
  // Emit notification event
  eventEmitter.emit('message.sent', {
    taskId,
    senderId: socket.user._id,
    messageId: message._id
  });
  
  // Broadcast to socket room
  io.to(taskId).emit('receiveMessage', message);
});
```

### In Task Update Controller

```javascript
// In tasksController.js
import { updateTaskService } from '../services/tasksService.js';

export const updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { updateData } = req.body;
    const updatedBy = req.user._id; // Get from auth middleware
    
    const result = await updateTaskService(taskId, updateData, updatedBy);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
```

## Notification Model

The notification is stored in the database with the following structure:

```javascript
{
  recipient: ObjectId, // User who receives the notification
  sender: ObjectId,    // User who triggered the notification (optional)
  message: String,     // Notification message
  link: String,        // Optional link to relevant page
  seen: Boolean,       // Whether the notification has been seen
  createdAt: Date,     // When the notification was created
  updatedAt: Date      // When the notification was last updated
}
```

## Adding New Notification Events

### 1. Add Event Listener

In `src/services/eventService.js`:

```javascript
// Add new event listener
eventEmitter.on('your.new.event', async (data) => {
  try {
    await notificationService.handleYourNewEvent(data);
  } catch (err) {
    console.error('❌ Error your.new.event notification:', err);
  }
});
```

### 2. Add Handler Method

In `src/services/notificationService.js`:

```javascript
async handleYourNewEvent(data) {
  try {
    const { param1, param2 } = data;
    
    // Your notification logic here
    const message = `Your custom message: ${param1}`;
    const link = `/your/custom/link`;
    
    await this.createNotification({
      recipient: 'user_id',
      sender: 'sender_id',
      message,
      link
    });
    
    console.log('✅ Your new event notification sent');
  } catch (error) {
    console.error('❌ Error handling your new event notification:', error);
  }
}
```

### 3. Add Utility Function

In `src/utils/notificationUtils.js`:

```javascript
export function notifyYourNewEvent(param1, param2) {
  eventEmitter.emit('your.new.event', {
    param1,
    param2
  });
}
```

## Best Practices

1. **Always use utility functions** when available for consistency
2. **Include relevant context** in notification messages
3. **Provide meaningful links** to help users navigate to relevant content
4. **Avoid duplicate notifications** by checking if the user is the same as the sender
5. **Handle errors gracefully** in event listeners
6. **Use descriptive event names** that clearly indicate what happened
7. **Include all necessary data** in the event payload

## Testing

To test the notification system:

1. **Create a task** - Should notify all admins
2. **Send a message** - Should notify task creator and assignee
3. **Assign a task** - Should notify the assigned user
4. **Change task status** - Should notify relevant users

## Database Queries

To view notifications:

```javascript
// Get all notifications for a user
const notifications = await Notification.find({ 
  recipient: userId 
}).sort({ createdAt: -1 });

// Get unread notifications
const unreadNotifications = await Notification.find({ 
  recipient: userId, 
  seen: false 
});

// Mark notification as seen
await Notification.findByIdAndUpdate(notificationId, { seen: true });
```

## Frontend Integration

The frontend can fetch notifications via API endpoints and display them in the notification page. The notification system provides the data structure needed for a complete notification UI.

## Error Handling

All notification events include proper error handling:
- Database errors are logged but don't break the main application flow
- Missing data is handled gracefully with warnings
- Event listeners are wrapped in try-catch blocks

This ensures that notification failures don't affect core application functionality.
