import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/mernapp';

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
    case 'Daily':
      return shouldCreateDailyTask(recurringSettings, currentDate, start);
    case 'Weekly':
      return shouldCreateWeeklyTask(recurringSettings, currentDate, start);
    case 'BiWeekly':
      return shouldCreateBiWeeklyTask(recurringSettings, currentDate, start);
    case 'ThreeDaysAWeek':
      return shouldCreateThreeDaysAWeekTask(
        recurringSettings,
        currentDate,
        start
      );
    case 'Monthly':
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
    return currentDate.getDay() === DAYS_OF_WEEK[monthlyDay];
  }

  return false;
}

async function processRecurringTasksForDate(db, targetDate) {
  console.log(
    `\n🔄 Processing recurring tasks for ${targetDate.toDateString()}...`
  );

  try {
    // Find all recurring tasks that are still active
    const recurringTasks = await db
      .collection('tasks')
      .find({
        isRecurring: true,
        $or: [
          { recurrenceEndDate: { $gt: targetDate } },
          { recurrenceEndDate: { $exists: false } }
        ],
        $and: [
          {
            $or: [{ parentTaskId: { $exists: false } }, { parentTaskId: null }]
          }
        ]
      })
      .toArray();

    let createdCount = 0;
    let skippedCount = 0;

    for (const parentTask of recurringTasks) {
      try {
        const shouldCreate = shouldCreateRecurringTask(parentTask, targetDate);

        if (shouldCreate) {
          // Check if task instance already exists for this date
          const dayStart = new Date(targetDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(targetDate);
          dayEnd.setHours(23, 59, 59, 999);

          const existingInstance = await db.collection('tasks').findOne({
            parentTaskId: parentTask._id,
            createdAt: {
              $gte: dayStart,
              $lte: dayEnd
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
              createdAt: new Date(targetDate),
              updatedAt: new Date(targetDate)
            };

            await db.collection('tasks').insertOne(newTask);
            createdCount++;
            console.log(`  ✅ Created: ${parentTask.title}`);
          } else {
            skippedCount++;
            console.log(`  ⏭️ Skipped: ${parentTask.title} (already exists)`);
          }
        }
      } catch (error) {
        console.error(
          `  ❌ Error processing task ${parentTask.title}:`,
          error.message
        );
      }
    }

    console.log(`  📊 Created: ${createdCount}, Skipped: ${skippedCount}`);
  } catch (error) {
    console.error('❌ Error in processRecurringTasksForDate:', error);
  }
}

async function setupTestData(db) {
  console.log('🔧 Setting up test data for weekly simulation...');

  try {
    // Clear existing test data
    await db
      .collection('tasks')
      .deleteMany({ title: { $regex: /^Weekly Test/ } });
    await db
      .collection('users')
      .deleteMany({ email: 'weeklytest@example.com' });
    console.log('✅ Cleared existing test data');
  } catch (error) {
    console.log('⚠️ Could not clear existing data, continuing with test...');
  }

  // Create test user
  const testUser = {
    firstName: 'Weekly',
    lastName: 'Test',
    email: 'weeklytest@example.com',
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

async function createWeeklyTestTasks(db, user) {
  console.log('📝 Creating weekly test tasks...');

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 21); // Start 3 weeks ago

  const tasks = [];

  // 1. Weekly task - Monday only
  const mondayTask = {
    title: 'Weekly Test - Monday Only',
    description: 'This task should run every Monday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Weekly',
      weeklyInterval: 1,
      weeklyDays: ['Monday'],
      startDate: startDate,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mondayResult = await db.collection('tasks').insertOne(mondayTask);
  tasks.push({ ...mondayTask, _id: mondayResult.insertedId });
  console.log('✅ Monday-only task created');

  // 2. Weekly task - Monday and Wednesday
  const mondayWednesdayTask = {
    title: 'Weekly Test - Monday & Wednesday',
    description: 'This task should run every Monday and Wednesday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'Weekly',
      weeklyInterval: 1,
      weeklyDays: ['Monday', 'Wednesday'],
      startDate: startDate,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mondayWednesdayResult = await db
    .collection('tasks')
    .insertOne(mondayWednesdayTask);
  tasks.push({ ...mondayWednesdayTask, _id: mondayWednesdayResult.insertedId });
  console.log('✅ Monday & Wednesday task created');

  // 3. Weekly task - Every 2 weeks on Monday
  const biWeeklyMondayTask = {
    title: 'Weekly Test - Bi-Weekly Monday',
    description: 'This task should run every 2 weeks on Monday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'BiWeekly',
      weeklyDays: ['Monday'],
      startDate: startDate,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const biWeeklyMondayResult = await db
    .collection('tasks')
    .insertOne(biWeeklyMondayTask);
  tasks.push({ ...biWeeklyMondayTask, _id: biWeeklyMondayResult.insertedId });
  console.log('✅ Bi-weekly Monday task created');

  // 4. Three days a week task - Monday, Wednesday, Friday
  const threeDaysTask = {
    title: 'Weekly Test - Three Days (Mon, Wed, Fri)',
    description:
      'This task should run 3 times a week on Monday, Wednesday, Friday',
    isRecurring: true,
    createdBy: user._id,
    creditCost: 1,
    recurringSettings: {
      pattern: 'ThreeDaysAWeek',
      weeklyDays: ['Monday', 'Wednesday', 'Friday'],
      startDate: startDate,
      endType: 'noEnd'
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const threeDaysResult = await db.collection('tasks').insertOne(threeDaysTask);
  tasks.push({ ...threeDaysTask, _id: threeDaysResult.insertedId });
  console.log('✅ Three days a week task created');

  return {
    mondayTask: tasks[0],
    mondayWednesdayTask: tasks[1],
    biWeeklyMondayTask: tasks[2],
    threeDaysTask: tasks[3]
  };
}

function getWeekDates(startDate, weeks = 3) {
  const dates = [];
  const current = new Date(startDate);

  // Find the start of the week (Monday)
  const dayOfWeek = current.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + daysToMonday);

  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(current);
      date.setDate(current.getDate() + week * 7 + day);
      dates.push(date);
    }
  }

  return dates;
}

async function testWeeklySimulation() {
  console.log('🚀 Starting 3-week weekly task simulation...\n');

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
    const db = client.db();
    const testUser = await setupTestData(db);
    const testTasks = await createWeeklyTestTasks(db, testUser);

    // Get 3 weeks of dates starting from 3 weeks ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 21); // 3 weeks ago
    const weekDates = getWeekDates(startDate, 3);

    console.log('\n📅 Running simulation for 3 weeks...');
    console.log('='.repeat(50));

    // Process each day
    for (const date of weekDates) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      console.log(`\n📅 ${dateStr}`);
      console.log('-'.repeat(30));

      await processRecurringTasksForDate(db, date);
    }

    console.log('\n📊 Final Results Summary:');
    console.log('='.repeat(50));

    // Check results for each task type
    for (const [taskName, task] of Object.entries(testTasks)) {
      const instances = await db
        .collection('tasks')
        .find({
          parentTaskId: task._id
        })
        .sort({ createdAt: 1 })
        .toArray();

      console.log(`\n${taskName}:`);
      console.log(`  Total instances: ${instances.length}`);

      if (instances.length > 0) {
        console.log('  Created on:');
        instances.forEach((instance, index) => {
          const date = new Date(instance.createdAt);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          });
          console.log(`    ${index + 1}. ${dayName}, ${dateStr}`);
        });
      }
    }

    console.log('\n🎯 Weekly simulation completed successfully!');
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
testWeeklySimulation();
