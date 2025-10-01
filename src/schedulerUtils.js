import mongoose from 'mongoose';

/**
 * Utility functions for scheduler operations
 * These functions work with the existing mongoose connection
 */

/**
 * Process auto-close of completed tasks that have been completed for more than 24 hours
 */
export async function processAutoCloseCompletedTasks() {
  try {
    console.log('🔄 Starting auto-close processing for completed tasks...');

    // Import Task model
    const TaskModule = await import('./models/Task.js');
    const Task = mongoose.connection.model('Task', TaskModule.default.schema);

    // Calculate the cutoff time (24 hours ago)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Find all completed tasks that were updated more than 24 hours ago
    const completedTasks = await Task.find({
      status: 'Completed',
      updatedAt: { $lte: twentyFourHoursAgo }
    }).populate('createdBy', 'name email');

    console.log(
      `📋 Found ${completedTasks.length} completed tasks to auto-close`
    );

    let closedCount = 0;
    let errorCount = 0;

    for (const task of completedTasks) {
      try {
        // Update the task status to 'Closed'
        await Task.findByIdAndUpdate(
          task._id,
          {
            status: 'Closed',
            updatedAt: new Date() // Update the timestamp to reflect the status change
          },
          { new: true }
        );

        closedCount++;
        console.log(`✅ Auto-closed task: ${task.title} (ID: ${task._id})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error auto-closing task ${task._id}:`, error.message);
      }
    }

    console.log(`🎯 Auto-close processing completed:`);
    console.log(`   - Tasks processed: ${completedTasks.length}`);
    console.log(`   - Tasks closed: ${closedCount}`);
    console.log(`   - Errors: ${errorCount}`);
  } catch (error) {
    console.error('❌ Error in processAutoCloseCompletedTasks:', error);
  }
}

/**
 * Process all recurring tasks and create new instances as needed
 */
export async function processRecurringTasks() {
  try {
    console.log('🔄 Starting recurring task processing...');

    // Import models
    const TaskModule = await import('./models/Task.js');
    const UserModule = await import('./models/User.js');
    const Task = mongoose.connection.model('Task', TaskModule.default.schema);
    const User = mongoose.connection.model('User', UserModule.default.schema);

    // Find all recurring tasks that are still active
    const recurringTasks = await Task.find({
      isRecurring: true,
      $or: [
        { recurrenceEndDate: { $gt: new Date() } },
        { recurrenceEndDate: { $exists: false } }
      ],
      $and: [
        {
          $or: [{ parentTaskId: { $exists: false } }, { parentTaskId: null }]
        }
      ]
    }).populate('createdBy', 'name email');

    console.log(`📋 Found ${recurringTasks.length} recurring tasks to process`);

    let createdCount = 0;
    let errorCount = 0;

    for (const parentTask of recurringTasks) {
      try {
        const shouldCreate = await shouldCreateRecurringTask(parentTask, Task);

        if (shouldCreate) {
          await createRecurringTaskInstance(parentTask, Task);
          createdCount++;
          console.log(
            `✅ Created recurring task instance for: ${parentTask.title}`
          );
        }
      } catch (error) {
        errorCount++;
        console.error(
          `❌ Error processing task ${parentTask._id}:`,
          error.message
        );
      }
    }

    console.log(`🎯 Recurring task processing completed:`);
    console.log(`   - Tasks processed: ${recurringTasks.length}`);
    console.log(`   - New instances created: ${createdCount}`);
    console.log(`   - Errors: ${errorCount}`);
  } catch (error) {
    console.error('❌ Error in processRecurringTasks:', error);
  }
}

/**
 * Check if a new recurring task instance should be created
 */
async function shouldCreateRecurringTask(parentTask, Task) {
  const now = new Date();
  const settings = parentTask.recurringSettings;

  if (!settings) {
    console.log(`⚠️ No recurring settings found for task: ${parentTask._id}`);
    return false;
  }

  // Check if we've reached the end date
  if (
    settings.endType === 'endBy' &&
    settings.endDate &&
    settings.endDate <= now
  ) {
    console.log(`⏰ Task ${parentTask._id} has reached its end date`);
    return false;
  }

  // Check if we've reached the end count
  if (settings.endType === 'endAfter') {
    const existingInstances = await Task.countDocuments({
      parentTaskId: parentTask._id
    });

    if (existingInstances >= settings.endAfterCount) {
      console.log(
        `🔢 Task ${parentTask._id} has reached its end count (${settings.endAfterCount})`
      );
      return false;
    }
  }

  // Check if we should create based on the pattern
  switch (settings.pattern) {
    case 'Daily':
      return shouldCreateDailyTask(parentTask, now, Task);
    case 'Weekly':
      return shouldCreateWeeklyTask(parentTask, now, Task);
    case 'BiWeekly':
      return shouldCreateBiWeeklyTask(parentTask, now, Task);
    case 'ThreeDaysAWeek':
      return shouldCreateThreeDaysAWeekTask(parentTask, now, Task);
    case 'Monthly':
      return shouldCreateMonthlyTask(parentTask, now, Task);
    default:
      console.log(`⚠️ Unknown recurrence pattern: ${settings.pattern}`);
      return false;
  }
}

/**
 * Check if a daily recurring task should be created
 */
async function shouldCreateDailyTask(parentTask, now, Task) {
  const settings = parentTask.recurringSettings;
  const interval = settings.dailyInterval || 1;

  // Find the last created instance
  const lastInstance = await Task.findOne({
    parentTaskId: parentTask._id
  }).sort({ createdAt: -1 });

  if (!lastInstance) {
    // First instance - check if we're past the start date
    return settings.startDate && settings.startDate <= now;
  }

  // Calculate days since last instance
  const daysSinceLastInstance = Math.floor(
    (now - lastInstance.createdAt) / (1000 * 60 * 60 * 24)
  );

  return daysSinceLastInstance >= interval;
}

/**
 * Check if a weekly recurring task should be created
 */
async function shouldCreateWeeklyTask(parentTask, now, Task) {
  const settings = parentTask.recurringSettings;
  const targetDays = settings.weeklyDays || [];

  if (targetDays.length === 0) {
    console.log(`⚠️ No weekly days specified for task: ${parentTask._id}`);
    return false;
  }

  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  // Check if today is one of the target days
  if (!targetDays.includes(currentDay)) {
    return false;
  }

  // Find the last created instance
  const lastInstance = await Task.findOne({
    parentTaskId: parentTask._id
  }).sort({ createdAt: -1 });

  if (!lastInstance) {
    // First instance - check if we're past the start date
    return settings.startDate && settings.startDate <= now;
  }

  return true; // Weekly tasks create on target days
}

/**
 * Check if a bi-weekly recurring task should be created
 */
async function shouldCreateBiWeeklyTask(parentTask, now, Task) {
  const settings = parentTask.recurringSettings;
  const targetDays = settings.weeklyDays || [];

  if (targetDays.length === 0) {
    console.log(
      `⚠️ No weekly days specified for bi-weekly task: ${parentTask._id}`
    );
    return false;
  }

  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  // Check if today is one of the target days
  if (!targetDays.includes(currentDay)) {
    return false;
  }

  // Find the last created instance
  const lastInstance = await Task.findOne({
    parentTaskId: parentTask._id
  }).sort({ createdAt: -1 });

  if (!lastInstance) {
    // First instance - check if we're past the start date
    return settings.startDate && settings.startDate <= now;
  }

  // Calculate weeks since last instance (bi-weekly = 2 weeks)
  const weeksSinceLastInstance = Math.floor(
    (now - lastInstance.createdAt) / (1000 * 60 * 60 * 24 * 7)
  );

  return weeksSinceLastInstance >= 2;
}

/**
 * Check if a three-days-a-week recurring task should be created
 */
async function shouldCreateThreeDaysAWeekTask(parentTask, now, Task) {
  const settings = parentTask.recurringSettings;
  const targetDays = settings.weeklyDays || [];

  if (targetDays.length === 0) {
    console.log(
      `⚠️ No weekly days specified for three-days-a-week task: ${parentTask._id}`
    );
    return false;
  }

  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  // Check if today is one of the target days
  if (!targetDays.includes(currentDay)) {
    return false;
  }

  // Find the last created instance
  const lastInstance = await Task.findOne({
    parentTaskId: parentTask._id
  }).sort({ createdAt: -1 });

  if (!lastInstance) {
    // First instance - check if we're past the start date
    return settings.startDate && settings.startDate <= now;
  }

  // For three-days-a-week, we need to check if we've had 3 instances this week
  // or if it's a new week
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Count instances created this week
  const instancesThisWeek = await Task.countDocuments({
    parentTaskId: parentTask._id,
    createdAt: {
      $gte: startOfWeek,
      $lte: endOfWeek
    }
  });

  // If we haven't reached 3 instances this week, create one
  return instancesThisWeek < 3;
}

/**
 * Check if a monthly recurring task should be created
 */
async function shouldCreateMonthlyTask(parentTask, now, Task) {
  const settings = parentTask.recurringSettings;
  const interval = settings.monthlyInterval || 1;

  // Find the last created instance
  const lastInstance = await Task.findOne({
    parentTaskId: parentTask._id
  }).sort({ createdAt: -1 });

  if (!lastInstance) {
    // First instance - check if we're past the start date
    return settings.startDate && settings.startDate <= now;
  }

  // Calculate months since last instance
  const monthsSinceLastInstance =
    (now.getFullYear() - lastInstance.createdAt.getFullYear()) * 12 +
    (now.getMonth() - lastInstance.createdAt.getMonth());

  if (monthsSinceLastInstance < interval) {
    return false;
  }

  // Check specific monthly criteria
  if (settings.monthlyDayOfMonth) {
    // Specific day of month (e.g., 15th)
    return now.getDate() === settings.monthlyDayOfMonth;
  }

  if (settings.monthlyDayOfWeek && settings.monthlyDay) {
    // Specific day of week in month (e.g., third Monday)
    return isTargetDayOfWeekInMonth(
      now,
      settings.monthlyDayOfWeek,
      settings.monthlyDay
    );
  }

  // Default: same day of month as start date
  return now.getDate() === settings.startDate.getDate();
}

/**
 * Check if current date matches the target day of week in month
 */
function isTargetDayOfWeekInMonth(date, weekNumber, dayName) {
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];
  const targetDayIndex = dayNames.indexOf(dayName);

  if (targetDayIndex === -1) return false;

  // Get the first day of the month
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay();

  // Calculate the first occurrence of the target day
  let firstTargetDay = 1 + ((targetDayIndex - firstDayOfWeek + 7) % 7);

  // Calculate the target occurrence based on week number
  let targetDate;
  switch (weekNumber) {
    case 'first':
      targetDate = firstTargetDay;
      break;
    case 'second':
      targetDate = firstTargetDay + 7;
      break;
    case 'third':
      targetDate = firstTargetDay + 14;
      break;
    case 'fourth':
      targetDate = firstTargetDay + 21;
      break;
    case 'last':
      // Find the last occurrence of the day in the month
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const lastDayOfWeek = lastDay.getDay();
      const lastTargetDay =
        lastDay.getDate() - ((lastDayOfWeek - targetDayIndex + 7) % 7);
      targetDate = lastTargetDay;
      break;
    default:
      return false;
  }

  return date.getDate() === targetDate;
}

/**
 * Create a new instance of a recurring task
 */
async function createRecurringTaskInstance(parentTask, Task) {
  try {
    // Create the new task instance
    const newTask = new Task({
      title: parentTask.title,
      description: parentTask.description,
      status: 'Submitted',
      createdBy: parentTask.createdBy,
      assignedTo: parentTask.assignedTo,
      assignedToRole: parentTask.assignedToRole,
      creditCost: parentTask.creditCost,
      dueDate: parentTask.dueDate,
      parentTaskId: parentTask._id,
      // Don't copy recurring settings to the instance
      isRecurring: false,
      files: [] // Don't copy files to new instances
    });

    await newTask.save();

    // Update the parent task's recurrenceId if it's the first instance
    if (!parentTask.recurrenceId) {
      parentTask.recurrenceId = newTask._id;
      await parentTask.save();
    }

    console.log(
      `✅ Created recurring task instance: ${newTask._id} for parent: ${parentTask._id}`
    );
    return newTask;
  } catch (error) {
    console.error(`❌ Error creating recurring task instance:`, error);
    throw error;
  }
}
