/**
 * Test script for the recurring task scheduler
 * This script demonstrates how to test the scheduler functionality
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './src/models/Task.js';
import User from './src/models/User.js';
import schedulerService from './src/services/schedulerService.js';

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create test data
const createTestData = async () => {
  try {
    console.log('🧪 Creating test data...');

    // Find a user to use for testing
    const user = await User.findOne();
    if (!user) {
      console.error('❌ No users found. Please create a user first.');
      return;
    }

    // Create a daily recurring task
    const dailyTask = new Task({
      title: 'Daily Standup Meeting',
      description: 'Team standup meeting every day',
      status: 'Submitted',
      createdBy: user._id,
      creditCost: 1,
      isRecurring: true,
      recurrencePattern: 'Daily',
      recurringSettings: {
        pattern: 'Daily',
        dailyInterval: 1,
        startDate: new Date(),
        endType: 'endAfter',
        endAfterCount: 5
      }
    });

    // Create a weekly recurring task
    const weeklyTask = new Task({
      title: 'Weekly Team Review',
      description: 'Weekly team performance review',
      status: 'Submitted',
      createdBy: user._id,
      creditCost: 2,
      isRecurring: true,
      recurrencePattern: 'Weekly',
      recurringSettings: {
        pattern: 'Weekly',
        weeklyInterval: 1,
        weeklyDays: ['Monday', 'Friday'],
        startDate: new Date(),
        endType: 'endBy',
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    });

    // Create a monthly recurring task
    const monthlyTask = new Task({
      title: 'Monthly Report',
      description: 'Generate monthly performance report',
      status: 'Submitted',
      createdBy: user._id,
      creditCost: 2,
      isRecurring: true,
      recurrencePattern: 'Monthly',
      recurringSettings: {
        pattern: 'Monthly',
        monthlyInterval: 1,
        monthlyDayOfMonth: 1, // 1st of every month
        startDate: new Date(),
        endType: 'endAfter',
        endAfterCount: 3
      }
    });

    await dailyTask.save();
    await weeklyTask.save();
    await monthlyTask.save();

    console.log('✅ Test data created:');
    console.log(`   - Daily task: ${dailyTask._id}`);
    console.log(`   - Weekly task: ${weeklyTask._id}`);
    console.log(`   - Monthly task: ${monthlyTask._id}`);

    return { dailyTask, weeklyTask, monthlyTask };
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
};

// Test the scheduler
const testScheduler = async () => {
  try {
    console.log('\n🔄 Testing scheduler...');

    // Get scheduler status
    const status = schedulerService.getStatus();
    console.log('📊 Scheduler status:', status);

    // Manually trigger processing
    console.log('🔧 Manually triggering recurring task processing...');
    await schedulerService.triggerProcessing();

    // Check results
    const recurringTasks = await Task.find({ isRecurring: true });
    console.log(`\n📋 Found ${recurringTasks.length} recurring tasks`);

    for (const task of recurringTasks) {
      const instances = await Task.find({ parentTaskId: task._id });
      console.log(`   - ${task.title}: ${instances.length} instances created`);
    }
  } catch (error) {
    console.error('❌ Error testing scheduler:', error);
  }
};

// Clean up test data
const cleanup = async () => {
  try {
    console.log('\n🧹 Cleaning up test data...');
    await Task.deleteMany({
      title: {
        $in: ['Daily Standup Meeting', 'Weekly Team Review', 'Monthly Report']
      }
    });
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up:', error);
  }
};

// Main test function
const runTest = async () => {
  try {
    await connectDB();

    console.log('🚀 Starting scheduler test...\n');

    // Create test data
    await createTestData();

    // Test scheduler
    await testScheduler();

    // Ask user if they want to clean up
    console.log('\n❓ Do you want to clean up test data? (y/n)');
    // For automated testing, we'll clean up automatically
    await cleanup();

    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the test
runTest();
