import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/mernapp';

// Recurring task patterns
const RECURRING_PATTERNS = {
  Daily: 'Daily',
  Weekly: 'Weekly',
  BiWeekly: 'BiWeekly',
  ThreeDaysAWeek: 'ThreeDaysAWeek',
  Monthly: 'Monthly'
};

// Days of the week mapping
const DAYS_OF_WEEK = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

function shouldCreateRecurringTask(task, currentDate = new Date()) {
  const { recurringSettings } = task;
  if (!recurringSettings) return false;

  const { pattern, startDate } = recurringSettings;
  const start = new Date(startDate);

  // Check if we're past the start date
  if (currentDate < start) return false;

  // Check end conditions
  if (recurringSettings.endType === 'endBy' && recurringSettings.endDate) {
    if (currentDate > new Date(recurringSettings.endDate)) return false;
  }

  if (
    recurringSettings.endType === 'endAfter' &&
    recurringSettings.endAfterCount
  ) {
    // This would require checking existing instances, simplified for now
    return true;
  }

  switch (pattern) {
    case RECURRING_PATTERNS.Daily:
      return shouldCreateDailyTask(recurringSettings, currentDate, start);

    case RECURRING_PATTERNS.Weekly:
      return shouldCreateWeeklyTask(recurringSettings, currentDate, start);

    case RECURRING_PATTERNS.BiWeekly:
      return shouldCreateBiWeeklyTask(recurringSettings, currentDate, start);

    case RECURRING_PATTERNS.ThreeDaysAWeek:
      return shouldCreateThreeDaysAWeekTask(
        recurringSettings,
        currentDate,
        start
      );

    case RECURRING_PATTERNS.Monthly:
      return shouldCreateMonthlyTask(recurringSettings, currentDate, start);

    default:
      return false;
  }
}

function shouldCreateDailyTask(settings, currentDate, startDate) {
  const { dailyInterval = 1 } = settings;
  const daysDiff = Math.floor(
    (currentDate - startDate) / (1000 * 60 * 60 * 24)
  );
  return daysDiff >= 0 && daysDiff % dailyInterval === 0;
}

function shouldCreateWeeklyTask(settings, currentDate, startDate) {
  const { weeklyInterval = 1, weeklyDays = [] } = settings;
  const currentDay = currentDate.getDay();
  const currentDayName = Object.keys(DAYS_OF_WEEK)[currentDay];

  if (!weeklyDays.includes(currentDayName)) return false;

  const weeksDiff = Math.floor(
    (currentDate - startDate) / (1000 * 60 * 60 * 24 * 7)
  );
  return weeksDiff >= 0 && weeksDiff % weeklyInterval === 0;
}

function shouldCreateBiWeeklyTask(settings, currentDate, startDate) {
  const { weeklyDays = [] } = settings;
  const currentDay = currentDate.getDay();
  const currentDayName = Object.keys(DAYS_OF_WEEK)[currentDay];

  if (!weeklyDays.includes(currentDayName)) return false;

  const weeksDiff = Math.floor(
    (currentDate - startDate) / (1000 * 60 * 60 * 24 * 7)
  );
  return weeksDiff >= 0 && weeksDiff % 2 === 0;
}

function shouldCreateThreeDaysAWeekTask(settings, currentDate, startDate) {
  const { weeklyDays = [] } = settings;
  const currentDay = currentDate.getDay();
  const currentDayName = Object.keys(DAYS_OF_WEEK)[currentDay];

  return weeklyDays.includes(currentDayName);
}

function shouldCreateMonthlyTask(settings, currentDate, startDate) {
  const {
    monthlyInterval = 1,
    monthlyDayOfMonth,
    monthlyDayOfWeek,
    monthlyDay
  } = settings;

  if (monthlyDayOfMonth) {
    return currentDate.getDate() === monthlyDayOfMonth;
  }

  if (monthlyDayOfWeek && monthlyDay) {
    // Simplified monthly logic - would need more complex implementation
    return currentDate.getDay() === DAYS_OF_WEEK[monthlyDay];
  }

  return false;
}

async function processRecurringTasksNative(db) {
  console.log('🔄 Starting recurring task processing with native driver...');

  try {
    // Find all recurring tasks that are still active
    const recurringTasks = await db
      .collection('tasks')
      .find({
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
      })
      .toArray();

    console.log(`📋 Found ${recurringTasks.length} recurring tasks to process`);

    let createdCount = 0;
    let errorCount = 0;

    for (const parentTask of recurringTasks) {
      try {
        const shouldCreate = shouldCreateRecurringTask(parentTask);

        if (shouldCreate) {
          // Check if task instance already exists for today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const existingInstance = await db.collection('tasks').findOne({
            parentTaskId: parentTask._id,
            createdAt: {
              $gte: today,
              $lt: tomorrow
            }
          });

          if (!existingInstance) {
            // Create new task instance
            const newTask = {
              title: parentTask.title,
              description: parentTask.description,
              isRecurring: false,
              parentTaskId: parentTask._id,
              createdBy: parentTask.createdBy,
              creditCost: parentTask.creditCost,
              status: 'pending',
              priority: parentTask.priority || 'medium',
              dueDate: parentTask.dueDate,
              tags: parentTask.tags || [],
              attachments: parentTask.attachments || [],
              createdAt: new Date(),
              updatedAt: new Date()
            };

            await db.collection('tasks').insertOne(newTask);
            createdCount++;
            console.log(
              `✅ Created recurring task instance for: ${parentTask.title}`
            );
          } else {
            console.log(
              `⏭️ Task instance already exists for today: ${parentTask.title}`
            );
          }
        }
      } catch (error) {
        errorCount++;
        console.error(
          `❌ Error processing task ${parentTask.title}:`,
          error.message
        );
      }
    }

    console.log(`\n📊 Processing complete:`);
    console.log(`✅ Created: ${createdCount} task instances`);
    console.log(`❌ Errors: ${errorCount} tasks failed`);
  } catch (error) {
    console.error('❌ Error in processRecurringTasks:', error);
  }
}

async function setupTestDataNative(client) {
  console.log('🔧 Setting up comprehensive test data...');

  const db = client.db();

  try {
    // Clear existing test data
    await db.collection('tasks').deleteMany({ title: { $regex: /^Test/ } });
    await db.collection('users').deleteMany({ email: 'test@example.com' });
    console.log('✅ Cleared existing test data');
  } catch (error) {
    console.log('⚠️ Could not clear existing data, continuing with test...');
  }

  // Create test user
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '+1234567890',
    passwordHash: 'hashedPassword',
    planType: '10_CREDITS',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const userResult = await db.collection('users').insertOne(testUser);
  console.log('✅ Test user created');

  return { ...testUser, _id: userResult.insertedId };
}

async function createTestTasksNative(client, user) {
  console.log('📝 Creating comprehensive test recurring tasks...');

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const db = client.db();
  const tasks = [];

  // 1. Daily task - every day
  const dailyTask = {
    title: 'Test Daily Task',
    description: 'This task should run every day',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Daily',
      dailyInterval: 1,
      startDate: yesterday,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const dailyResult = await db.collection('tasks').insertOne(dailyTask);
  tasks.push({ ...dailyTask, _id: dailyResult.insertedId });
  console.log('✅ Daily task created');

  // 2. Daily task - every 2 days
  const dailyIntervalTask = {
    title: 'Test Every 2 Days Task',
    description: 'This task should run every 2 days',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Daily',
      dailyInterval: 2,
      startDate: twoWeeksAgo,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const dailyIntervalResult = await db
    .collection('tasks')
    .insertOne(dailyIntervalTask);
  tasks.push({ ...dailyIntervalTask, _id: dailyIntervalResult.insertedId });
  console.log('✅ Every 2 days task created');

  // 3. Weekly task - every Monday
  const weeklyTask = {
    title: 'Test Weekly Task',
    description: 'This task should run every Monday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Weekly',
      weeklyInterval: 1,
      weeklyDays: ['Monday'],
      startDate: lastWeek,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const weeklyResult = await db.collection('tasks').insertOne(weeklyTask);
  tasks.push({ ...weeklyTask, _id: weeklyResult.insertedId });
  console.log('✅ Weekly task created');

  // 4. Weekly task - multiple days
  const weeklyMultiTask = {
    title: 'Test Weekly Multi-Day Task',
    description: 'This task should run on Monday, Wednesday, Friday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Weekly',
      weeklyInterval: 1,
      weeklyDays: ['Monday', 'Wednesday', 'Friday'],
      startDate: lastWeek,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const weeklyMultiResult = await db
    .collection('tasks')
    .insertOne(weeklyMultiTask);
  tasks.push({ ...weeklyMultiTask, _id: weeklyMultiResult.insertedId });
  console.log('✅ Weekly multi-day task created');

  // 5. Bi-weekly task
  const biWeeklyTask = {
    title: 'Test Bi-Weekly Task',
    description: 'This task should run every 2 weeks on Monday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'BiWeekly',
      weeklyDays: ['Monday'],
      startDate: twoWeeksAgo,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const biWeeklyResult = await db.collection('tasks').insertOne(biWeeklyTask);
  tasks.push({ ...biWeeklyTask, _id: biWeeklyResult.insertedId });
  console.log('✅ Bi-weekly task created');

  // 6. Three days a week task
  const threeDaysTask = {
    title: 'Test Three Days A Week Task',
    description:
      'This task should run 3 times a week on Monday, Wednesday, Friday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'ThreeDaysAWeek',
      weeklyDays: ['Monday', 'Wednesday', 'Friday'],
      startDate: lastWeek,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const threeDaysResult = await db.collection('tasks').insertOne(threeDaysTask);
  tasks.push({ ...threeDaysTask, _id: threeDaysResult.insertedId });
  console.log('✅ Three days a week task created');

  // 7. Monthly task - specific day of month
  const monthlyTask = {
    title: 'Test Monthly Task',
    description: 'This task should run on the 15th of every month',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Monthly',
      monthlyInterval: 1,
      monthlyDayOfMonth: 15,
      startDate: lastMonth,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const monthlyResult = await db.collection('tasks').insertOne(monthlyTask);
  tasks.push({ ...monthlyTask, _id: monthlyResult.insertedId });
  console.log('✅ Monthly task (day of month) created');

  // 8. Monthly task - specific day of week in month
  const monthlyWeekTask = {
    title: 'Test Monthly Week Task',
    description: 'This task should run on the first Monday of every month',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Monthly',
      monthlyInterval: 1,
      monthlyDayOfWeek: 'first',
      monthlyDay: 'Monday',
      startDate: lastMonth,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const monthlyWeekResult = await db
    .collection('tasks')
    .insertOne(monthlyWeekTask);
  tasks.push({ ...monthlyWeekTask, _id: monthlyWeekResult.insertedId });
  console.log('✅ Monthly task (day of week) created');

  // 9. Task with end date
  const endDateTask = {
    title: 'Test End Date Task',
    description: 'This task should stop after tomorrow',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Daily',
      dailyInterval: 1,
      startDate: yesterday,
      endType: 'endBy',
      endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const endDateResult = await db.collection('tasks').insertOne(endDateTask);
  tasks.push({ ...endDateTask, _id: endDateResult.insertedId });
  console.log('✅ End date task created');

  // 10. Task with end count
  const endCountTask = {
    title: 'Test End Count Task',
    description: 'This task should stop after 3 instances',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Daily',
      dailyInterval: 1,
      startDate: yesterday,
      endType: 'endAfter',
      endAfterCount: 3
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const endCountResult = await db.collection('tasks').insertOne(endCountTask);
  tasks.push({ ...endCountTask, _id: endCountResult.insertedId });
  console.log('✅ End count task created');

  return {
    dailyTask: tasks[0],
    dailyIntervalTask: tasks[1],
    weeklyTask: tasks[2],
    weeklyMultiTask: tasks[3],
    biWeeklyTask: tasks[4],
    threeDaysTask: tasks[5],
    monthlyTask: tasks[6],
    monthlyWeekTask: tasks[7],
    endDateTask: tasks[8],
    endCountTask: tasks[9]
  };
}

async function testSchedulerComprehensiveNative() {
  console.log('🚀 Starting comprehensive native scheduler test...\n');

  let client;
  try {
    // Connect using native MongoDB driver
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    await client.connect();
    console.log('✅ Connected to database\n');

    // Setup test data
    const testUser = await setupTestDataNative(client);
    const testTasks = await createTestTasksNative(client, testUser);

    console.log('\n🔄 Running scheduler...');
    await processRecurringTasksNative(client.db());

    console.log('\n📊 Results:');
    console.log('================');

    // Check results for each task type
    const db = client.db();
    for (const [taskName, task] of Object.entries(testTasks)) {
      const instances = await db
        .collection('tasks')
        .find({ parentTaskId: task._id })
        .toArray();
      console.log(`${taskName}: ${instances.length} instances created`);

      if (instances.length > 0) {
        console.log(
          `  - Latest instance: ${instances[instances.length - 1].createdAt.toISOString()}`
        );
        console.log(`  - Status: ${instances[instances.length - 1].status}`);
      }
    }

    console.log('\n🔍 Detailed Analysis:');
    console.log('====================');

    // Test different scenarios
    const currentDay = new Date().toLocaleDateString('en-US', {
      weekday: 'long'
    });
    console.log(`Current day: ${currentDay}`);

    // Check if weekly tasks should have been created
    const weeklyInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.weeklyTask._id
      })
      .toArray();
    const weeklyMultiInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.weeklyMultiTask._id
      })
      .toArray();
    const biWeeklyInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.biWeeklyTask._id
      })
      .toArray();
    const threeDaysInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.threeDaysTask._id
      })
      .toArray();

    console.log(`\nWeekly task instances: ${weeklyInstances.length}`);
    console.log(
      `Weekly multi-day task instances: ${weeklyMultiInstances.length}`
    );
    console.log(`Bi-weekly task instances: ${biWeeklyInstances.length}`);
    console.log(
      `Three days a week task instances: ${threeDaysInstances.length}`
    );

    // Check monthly tasks
    const monthlyInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.monthlyTask._id
      })
      .toArray();
    const monthlyWeekInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.monthlyWeekTask._id
      })
      .toArray();

    console.log(
      `\nMonthly task (day of month) instances: ${monthlyInstances.length}`
    );
    console.log(
      `Monthly task (day of week) instances: ${monthlyWeekInstances.length}`
    );

    // Check end date and end count tasks
    const endDateInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.endDateTask._id
      })
      .toArray();
    const endCountInstances = await db
      .collection('tasks')
      .find({
        parentTaskId: testTasks.endCountTask._id
      })
      .toArray();

    console.log(`\nEnd date task instances: ${endDateInstances.length}`);
    console.log(`End count task instances: ${endCountInstances.length}`);

    // Test three days a week logic
    if (['Monday', 'Wednesday', 'Friday'].includes(currentDay)) {
      console.log(
        `\n✅ Today (${currentDay}) is a target day for three-days-a-week task`
      );
      if (threeDaysInstances.length > 0) {
        console.log(`✅ Three-days-a-week task created an instance`);
      } else {
        console.log(`❌ Three-days-a-week task did not create an instance`);
      }
    } else {
      console.log(
        `\nℹ️ Today (${currentDay}) is not a target day for three-days-a-week task`
      );
    }

    // Test bi-weekly logic
    if (currentDay === 'Monday') {
      console.log(
        `\n✅ Today (${currentDay}) is a target day for bi-weekly task`
      );
      if (biWeeklyInstances.length > 0) {
        console.log(`✅ Bi-weekly task created an instance`);
      } else {
        console.log(`❌ Bi-weekly task did not create an instance`);
      }
    } else {
      console.log(
        `\nℹ️ Today (${currentDay}) is not a target day for bi-weekly task`
      );
    }

    console.log('\n🎯 Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the test
testSchedulerComprehensiveNative();
