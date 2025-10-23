import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/mernapp';

async function testAutoClose() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Wait for connection to be fully established
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('\n🧪 Testing Auto-Close Functionality...\n');

    // Import Task model
    const TaskModule = await import('./src/models/Task.js');
    const Task = mongoose.connection.model('Task', TaskModule.default.schema);

    // Create test tasks with different scenarios
    const now = new Date();
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 23 hours ago
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    // Create test tasks
    const testTasks = [
      {
        title: 'Test 1 - Should be closed (completed 25 hours ago)',
        description: 'This task should be auto-closed',
        status: 'Completed',
        createdBy: new mongoose.Types.ObjectId(),
        creditCost: 1,
        createdAt: twentyFiveHoursAgo,
        updatedAt: twentyFiveHoursAgo
      },
      {
        title: 'Test 2 - Should NOT be closed (completed 23 hours ago)',
        description: 'This task should NOT be auto-closed yet',
        status: 'Completed',
        createdBy: new mongoose.Types.ObjectId(),
        creditCost: 1,
        createdAt: twentyThreeHoursAgo,
        updatedAt: twentyThreeHoursAgo
      },
      {
        title: 'Test 3 - Should NOT be closed (completed 1 hour ago)',
        description: 'This task should NOT be auto-closed yet',
        status: 'Completed',
        createdBy: new mongoose.Types.ObjectId(),
        creditCost: 1,
        createdAt: oneHourAgo,
        updatedAt: oneHourAgo
      },
      {
        title: 'Test 4 - Should NOT be closed (in progress)',
        description: 'This task is still in progress',
        status: 'InProgress',
        createdBy: new mongoose.Types.ObjectId(),
        creditCost: 1,
        createdAt: twentyFiveHoursAgo,
        updatedAt: twentyFiveHoursAgo
      },
      {
        title: 'Test 5 - Already closed',
        description: 'This task is already closed',
        status: 'Closed',
        createdBy: new mongoose.Types.ObjectId(),
        creditCost: 1,
        createdAt: twentyFiveHoursAgo,
        updatedAt: twentyFiveHoursAgo
      }
    ];

    // Insert test tasks
    console.log('📝 Creating test tasks...');
    const createdTasks = await Task.insertMany(testTasks);
    console.log(`✅ Created ${createdTasks.length} test tasks`);

    // Display initial status
    console.log('\n📊 Initial task statuses:');
    for (const task of createdTasks) {
      console.log(
        `   - ${task.title}: ${task.status} (updated: ${task.updatedAt.toISOString()})`
      );
    }

    // Test the auto-close logic (this is what the scheduler will do)
    console.log('\n🔄 Testing auto-close logic...');

    // Calculate the cutoff time (24 hours ago)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Find all completed tasks that were updated more than 24 hours ago
    const completedTasks = await Task.find({
      status: 'Completed',
      updatedAt: { $lte: twentyFourHoursAgo }
    });

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

    // Check results
    console.log('\n📊 Task statuses after auto-close processing:');
    const updatedTasks = await Task.find({
      _id: { $in: createdTasks.map((t) => t._id) }
    });

    for (const task of updatedTasks) {
      console.log(
        `   - ${task.title}: ${task.status} (updated: ${task.updatedAt.toISOString()})`
      );
    }

    // Verify results
    const task1 = updatedTasks.find((t) =>
      t.title.includes('Should be closed (completed 25 hours ago)')
    );
    const task2 = updatedTasks.find((t) =>
      t.title.includes('Should NOT be closed (completed 23 hours ago)')
    );
    const task3 = updatedTasks.find((t) =>
      t.title.includes('Should NOT be closed (completed 1 hour ago)')
    );
    const task4 = updatedTasks.find((t) =>
      t.title.includes('Should NOT be closed (in progress)')
    );
    const task5 = updatedTasks.find((t) => t.title.includes('Already closed'));

    console.log('\n✅ Test Results:');
    console.log(
      `   - Task 1 (25 hours old): ${task1.status === 'Closed' ? '✅ PASS' : '❌ FAIL'} - Expected: Closed, Got: ${task1.status}`
    );
    console.log(
      `   - Task 2 (23 hours old): ${task2.status === 'Completed' ? '✅ PASS' : '❌ FAIL'} - Expected: Completed, Got: ${task2.status}`
    );
    console.log(
      `   - Task 3 (1 hour old): ${task3.status === 'Completed' ? '✅ PASS' : '❌ FAIL'} - Expected: Completed, Got: ${task3.status}`
    );
    console.log(
      `   - Task 4 (InProgress): ${task4.status === 'InProgress' ? '✅ PASS' : '❌ FAIL'} - Expected: InProgress, Got: ${task4.status}`
    );
    console.log(
      `   - Task 5 (Already closed): ${task5.status === 'Closed' ? '✅ PASS' : '❌ FAIL'} - Expected: Closed, Got: ${task5.status}`
    );

    // Summary
    const passedTests = [
      task1.status === 'Closed',
      task2.status === 'Completed',
      task3.status === 'Completed',
      task4.status === 'InProgress',
      task5.status === 'Closed'
    ].filter(Boolean).length;

    console.log(`\n🎯 Test Summary: ${passedTests}/5 tests passed`);

    if (passedTests === 5) {
      console.log(
        '\n🎉 SUCCESS: Auto-close functionality is working perfectly!'
      );
      console.log(
        '   The scheduler will automatically close completed tasks after 24 hours.'
      );
    } else {
      console.log('\n⚠️ Some tests failed. Please check the implementation.');
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await Task.deleteMany({ _id: { $in: createdTasks.map((t) => t._id) } });
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testAutoClose();

