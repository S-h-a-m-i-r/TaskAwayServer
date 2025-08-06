import Task from '../models/Task.js';
import User from '../models/User.js';
import TaskHistory from '../models/TaskHistory.js';
import { Plan, complexKeywords } from '../utils/utilityEnums.js';
import Message from '../models/Message.js';

export async function createTaskService(taskData, files, user) {
  try {
    if (!taskData || !user) {
      throw new Error('Task data and user information are required');
    }
    console.log('Creating task with data:', taskData, 'and user:', user.plan);
    let creditCost = 1; // Default value
    
    if (user.planType === Plan['10_CREDITS']) {
      creditCost = await determineTaskCredits(taskData.description || '');
      console.log(`Credit cost determined: ${creditCost}`);
      
      // Validate that creditCost is within allowed enum values
      if (![1, 2].includes(creditCost)) {
        throw new Error(`Invalid credit cost: ${creditCost}. Must be 1 or 2.`);
      }
    }

    // Handle file uploads to S3
    // if (files && files.length > 0) {
    //   if (files.length > 12) {
    //     throw new AppError('Maximum 12 files allowed', 400);
    //   }
    //   const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    //   if (totalSize > 60 * 1024 * 1024) {
    //     throw new AppError('Total file size exceeds 60MB', 400);
    //   }

      // const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'];
      // for (const file of files) {
      //   if (!allowedTypes.includes(file.mimetype)) {
      //     throw new AppError('Invalid file type. Allowed: PDF, JPEG, PNG, text', 400);
      //   }
      // }

    //   const uploadedFiles = await Promise.all(
    //     files.map(async (file) => {
    //       const params = {
    //         Bucket: process.env.AWS_S3_BUCKET,
    //         Key: `tasks/${Date.now()}-${file.originalname}`,
    //         Body: file.buffer,
    //         ContentType: file.mimetype,
    //         ACL: 'public-read' // Use signed URLs for production
    //       };
    //       const { Location } = await s3.upload(params).promise();
    //       return {
    //         filename: file.originalname,
    //         url: Location,
    //         size: file.size,
    //         type: file.mimetype,
    //         uploadedAt: new Date()
    //       };
    //     })
    //   );

    //   taskData.files = uploadedFiles;
    // }

    // Create task
    taskData.createdBy = user._id;
    const task = new Task(taskData);
    await task.save();

    // Deduct credits for non-unlimited plan
    // if (user.plan === '10_credits') {
    //   user.credits -= task.creditCost;
    //   user.creditPurchases.push({ credits: task.creditCost, purchaseDate: new Date(), taskId: task._id });
    //   await user.save();
    // }

    return { success: true, data: task };
  } catch (err) {
    err.status = err.status || 400;
    err.message = err.message || 'Failed to create task';
    throw err;
  }
}

export async function viewTaskService(taskId, user = null) {
  if (!taskId) {
    const error = new Error('Task ID is required');
    error.status = 400;
    throw error;
  }

  const task = await Task.findById(taskId)
  .populate('assignedTo', 'firstName lastName email role')
  .populate('createdBy', 'firstName lastName email planType');

  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  }

  const messages = await Message.find({ taskId })
    .populate('senderId', 'name email')
    .sort({ timestamp: 1 });

  // Determine if current user is the assignee
  const isAssignee =
    user &&
    task.assignedTo &&
    task.assignedTo._id.toString() === user._id.toString();
  const isOwner = user && task.createdBy.toString() === user._id.toString();

  return {
    success: true,
    data: {
      task,
      messages,
      canChat: isAssignee || isOwner, // Allow chat if user is assignee or owner
      userRole: {
        isAssignee,
        isOwner,
        isAssigned: !!task.assignedTo
      }
    }
  };
}


export async function taskAssignService(taskId, userId) {
  if (!taskId || !userId) {
    const error = new Error('Task ID and User ID are required');
    error.status = 400;
    throw error;
  }

  const task = await Task.findById(taskId);
  const user = await User.findById(userId);
  if (!task || !user) {
    const error = new Error('Task Or User not found');
    error.status = 404;
    throw error;
  } 
  if (task.assignedTo) {
    const error = new Error('Task is already assigned');
    error.status = 400;
    throw error;
  } 
    task.assignedTo = user?.id;
    task.assignedToRole = user?.role;
    await task.save();
    return { success: true, data: task };
  
}


export async function taskReAssignService(taskId, userId) {
  if (!taskId || !userId) {
    const error = new Error('Task ID and User ID are required');
    error.status = 400;
    throw error;
  }

  const task = await Task.findById(taskId);
  const user = await User.findById(userId);
  await updateTaskHistory(task, user);
  if (!task || !user) {
    const error = new Error('Task Or User not found');
    error.status = 404;
    throw error;
  } else {  
    task.assignedTo = user?.id;
    task.assignedToRole = user?.role;
    await task.save();
    return { success: true, data: task };
  }
}

async function updateTaskHistory(task, newUser) {
  // Only log if task was previously assigned
  if (task.assignedTo) {
    const kickingOutUser = await User.findById(task.assignedTo);

    await TaskHistory.create({
      taskId: task._id,
      kickingOutUserId: kickingOutUser?._id || null,
      kickingOutUserRole: kickingOutUser?.role || null,
      currentlyAssignedUserId: newUser._id,
      currentlyAssignedUserRole: newUser.role
    });
  } else {
    await TaskHistory.create({
      taskId: task._id,
      currentlyAssignedUserId: newUser._id,
      currentlyAssignedUserRole: newUser.role
    });
  }
}

export async function updateTaskService(taskId, updateData) {
  if (!taskId || !updateData) {
    const error = new Error('Task ID and update data are required');
    error.status = 400;
    throw error;
  }

  const task = await Task.findByIdAndUpdate(taskId, updateData, { new: true });
  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  }

  return { success: true, data: task };
}
export async function deleteTaskService(taskId) {
  if (!taskId) {
    const error = new Error('Task ID is required');
    error.status = 400;
    throw error;
  }

  const task = await Task.findByIdAndDelete(taskId);
  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  } else {
    return { success: true, message: 'Task deleted successfully' };
  }
}

export async function listTasksService(query, user) {
  const { status, title, sortBy = 'createdAt', order = 'desc' } = query;
  const filter = user.role === 'CUSTOMER' ? { createdBy: user._id } : {};
  
  if (status) {
    filter.status = status;
  }
  if (title) {
    filter.title = { $regex: title, $options: 'i' }; // Case-insensitive search
  }

  const tasks = await Task.find(filter)
    .populate('assignedTo', 'name email')
    .sort({ [sortBy]: order === 'desc' ? -1 : 1 });

  return { success: true, tasks: tasks };
}

export async function determineTaskCredits(description) {
  return complexKeywords.some(keyword => description.toLowerCase().includes(keyword)) ? 2 : 1;
}

