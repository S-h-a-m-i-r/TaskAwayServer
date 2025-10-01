import Task from '../models/Task.js';
import User from '../models/User.js';
import TaskHistory from '../models/TaskHistory.js';
import { Plan, complexKeywords } from '../utils/utilityEnums.js';
import Message from '../models/Message.js';
import { deductCredits } from './creditsService.js';
import Credit from '../models/Credit.js';

export async function createTaskService(taskData, user) {
  try {
    if (!taskData || !user) {
      throw new Error('Task data and user information are required');
    }
    let creditCost = 1; // Default value
    let creditBatches = [];
    if (user.planType === Plan['10_CREDITS']) {
      creditCost = await determineTaskCredits(
        taskData.description || '',
        taskData.isRecurring
      );
      creditBatches = await Credit.find({
        user: user?._id,
        remainingCredits: { $gt: 0 },
        expiresAt: { $gt: new Date() }
      }).sort({ expiresAt: 1 });

      if (!creditBatches.length) {
        throw new Error('No available credits for this user');
      }

      // Calculate total available credits
      const totalAvailable = creditBatches.reduce(
        (sum, batch) => sum + batch.remainingCredits,
        0
      );

      if (totalAvailable < creditCost) {
        const err = new Error('Not enough credits to create this task');
        err.code = 'INSUFFICIENT_CREDITS';
        err.availableCredits = totalAvailable;
        err.requiredCredits = creditCost;
        throw err;
      }
      // Validate that creditCost is within allowed enum values
      if (![1, 2].includes(creditCost)) {
        throw new Error(`Invalid credits cost: ${creditCost}. Must be 1 or 2.`);
      }
    }

    if (taskData.status) {
      const validStatuses = ['Submitted', 'InProgress', 'Completed', 'Closed'];
      if (!validStatuses.includes(taskData.status)) {
        throw new Error(
          `Invalid status: ${taskData.status}. Valid statuses are: ${validStatuses.join(', ')}`
        );
      }
    }

    // Handle recurring task settings
    if (taskData.isRecurring && taskData.recurringSettings) {
      // Extract pattern from recurringSettings
      taskData.recurrencePattern = taskData.recurringSettings.pattern;
      // Set recurrence end date based on endType
      if (
        taskData.recurringSettings.endType === 'endBy' &&
        taskData.recurringSettings.endDate
      ) {
        taskData.recurrenceEndDate = new Date(
          taskData.recurringSettings.endDate
        );
      } else if (
        taskData.recurringSettings.endType === 'endAfter' &&
        taskData.recurringSettings.endAfterCount
      ) {
        // For endAfter, we'll calculate the end date based on the pattern and count
        // This will be handled when the task is created
        taskData.recurrenceEndDate = calculateEndDateFromCount(
          taskData.recurringSettings.startDate,
          taskData.recurrencePattern,
          taskData.recurringSettings.endAfterCount,
          taskData.recurringSettings
        );
      }
      // For 'noEnd', recurrenceEndDate remains null
    } else if (
      taskData.isRecurring &&
      taskData.recurrencePattern &&
      !taskData.dueDate
    ) {
      // Fallback for backward compatibility
      taskData.dueDate = null;
    }

    taskData.createdBy = user._id;
    taskData.creditCost = creditCost;
    const task = new Task(taskData);
    await task.save();
    await deductCredits(user._id, task._id, creditCost, creditBatches);

    return {
      success: true,
      task: { _id: task._id, message: 'Task created Successfully' }
    };
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
  task.status = 'InProgress';
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

  // Validate and normalize status if it's being updated
  if (updateData.status) {
    const validStatuses = ['Submitted', 'InProgress', 'Completed', 'Closed'];
    if (!validStatuses.includes(updateData.status)) {
      const error = new Error(
        `Invalid status: ${updateData.status}. Valid statuses are: ${validStatuses.join(', ')}`
      );
      error.status = 400;
      throw error;
    }
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
    filter.title = { $regex: title, $options: 'i' };
  }

  const tasks = await Task.find(filter)
    .populate('assignedTo', 'firstName lastName userName email role')
    .populate('createdBy', 'firstName lastName userName email role')
    .sort({ [sortBy]: order === 'desc' ? -1 : 1 });

  return { success: true, tasks: tasks };
}

export async function determineTaskCredits(description, isRecurring = false) {
  function containsKeyword(description) {
    const lowerDesc = description.toLowerCase();

    return complexKeywords.some((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i'); // case-insensitive, whole word
      return regex.test(lowerDesc);
    });
  }
  let cost = 1;
  if (isRecurring) {
    cost = 2;
  } else {
    cost = containsKeyword(description) ? 2 : 1;
  }
  return cost;
}

function calculateEndDateFromCount(startDate, pattern, count, settings) {
  if (!startDate || !count || count <= 0) return null;

  const start = new Date(startDate);
  let currentDate = new Date(start);

  // Calculate the end date based on pattern and count
  for (let i = 1; i < count; i++) {
    switch (pattern) {
      case 'Daily':
        currentDate.setUTCDate(
          currentDate.getUTCDate() + (settings.dailyInterval || 1)
        );
        break;
      case 'Weekly':
        const weeklyInterval = settings.weeklyInterval || 1;
        currentDate.setUTCDate(currentDate.getUTCDate() + 7 * weeklyInterval);
        break;
      case 'Monthly':
        const monthlyInterval = settings.monthlyInterval || 1;
        currentDate.setUTCMonth(currentDate.getUTCMonth() + monthlyInterval);
        break;
      case 'Yearly':
        const yearlyInterval = settings.yearlyInterval || 1;
        currentDate.setUTCFullYear(
          currentDate.getUTCFullYear() + yearlyInterval
        );
        break;
      default:
        return null;
    }
  }

  return currentDate;
}