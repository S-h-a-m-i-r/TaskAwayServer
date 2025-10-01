import {
  jest,
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach
} from '@jest/globals';
import mongoose from 'mongoose';
import Task from '../../../src/models/Task.js';
import User from '../../../src/models/User.js';
import SchedulerService from '../../../src/services/schedulerService.js';

// Mock console methods to reduce noise during tests
const originalConsole = global.console;
beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
});

afterAll(() => {
  global.console = originalConsole;
});

describe('SchedulerService', () => {
  let testUser;
  let schedulerService;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_TEST_URI ||
          'mongodb://localhost:27017/taskaway_test'
      );
    }
  });

  beforeEach(async () => {
    // Clear all collections
    await Task.deleteMany({});
    await User.deleteMany({});

    // Create a test user
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedPassword',
      planType: '10_CREDITS'
    });
    await testUser.save();

    // Reset scheduler service
    schedulerService = new (class extends SchedulerService {
      constructor() {
        super();
      }
    })();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Daily Recurring Tasks', () => {
    test('should create first daily task instance when start date has passed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'Daily Task',
        description: 'Test daily task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: yesterday,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      const shouldCreate = await schedulerService.shouldCreateDailyTask(
        parentTask,
        new Date()
      );
      expect(shouldCreate).toBe(true);
    });

    test('should not create first daily task instance when start date has not passed', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const parentTask = new Task({
        title: 'Daily Task',
        description: 'Test daily task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: tomorrow,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      const shouldCreate = await schedulerService.shouldCreateDailyTask(
        parentTask,
        new Date()
      );
      expect(shouldCreate).toBe(false);
    });

    test('should create daily task instance after interval has passed', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const parentTask = new Task({
        title: 'Daily Task',
        description: 'Test daily task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: twoDaysAgo,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create a previous instance
      const lastInstance = new Task({
        title: 'Daily Task',
        description: 'Test daily task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: twoDaysAgo
      });
      await lastInstance.save();

      const shouldCreate = await schedulerService.shouldCreateDailyTask(
        parentTask,
        new Date()
      );
      expect(shouldCreate).toBe(true);
    });

    test('should not create daily task instance before interval has passed', async () => {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const parentTask = new Task({
        title: 'Daily Task',
        description: 'Test daily task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: oneHourAgo,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create a previous instance
      const lastInstance = new Task({
        title: 'Daily Task',
        description: 'Test daily task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: oneHourAgo
      });
      await lastInstance.save();

      const shouldCreate = await schedulerService.shouldCreateDailyTask(
        parentTask,
        new Date()
      );
      expect(shouldCreate).toBe(false);
    });

    test('should handle daily task with custom interval', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const parentTask = new Task({
        title: 'Every 2 Days Task',
        description: 'Test every 2 days task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 2,
          startDate: threeDaysAgo,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create a previous instance
      const lastInstance = new Task({
        title: 'Every 2 Days Task',
        description: 'Test every 2 days task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: threeDaysAgo
      });
      await lastInstance.save();

      const shouldCreate = await schedulerService.shouldCreateDailyTask(
        parentTask,
        new Date()
      );
      expect(shouldCreate).toBe(true);
    });
  });

  describe('Weekly Recurring Tasks', () => {
    test('should create weekly task on specified day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'Weekly Task',
        description: 'Test weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Weekly',
          weeklyInterval: 1,
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: yesterday,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateWeeklyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(true);

      jest.restoreAllMocks();
    });

    test('should not create weekly task on non-specified day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'Weekly Task',
        description: 'Test weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Weekly',
          weeklyInterval: 1,
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: yesterday,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Mock current day as Tuesday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 2); // Tuesday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateWeeklyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(false);

      jest.restoreAllMocks();
    });

    test('should create weekly task after interval has passed', async () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const parentTask = new Task({
        title: 'Weekly Task',
        description: 'Test weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Weekly',
          weeklyInterval: 1,
          weeklyDays: ['Monday'],
          startDate: twoWeeksAgo,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create a previous instance
      const lastInstance = new Task({
        title: 'Weekly Task',
        description: 'Test weekly task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: twoWeeksAgo
      });
      await lastInstance.save();

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateWeeklyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('Bi-Weekly Recurring Tasks', () => {
    test('should create bi-weekly task on specified day after 2 weeks', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'Bi-Weekly Task',
        description: 'Test bi-weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'BiWeekly',
          weeklyDays: ['Monday'],
          startDate: yesterday,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateBiWeeklyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(true);

      jest.restoreAllMocks();
    });

    test('should not create bi-weekly task before 2 weeks have passed', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const parentTask = new Task({
        title: 'Bi-Weekly Task',
        description: 'Test bi-weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'BiWeekly',
          weeklyDays: ['Monday'],
          startDate: oneWeekAgo,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create a previous instance
      const lastInstance = new Task({
        title: 'Bi-Weekly Task',
        description: 'Test bi-weekly task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: oneWeekAgo
      });
      await lastInstance.save();

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateBiWeeklyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('Three Days A Week Recurring Tasks', () => {
    test('should create three-days-a-week task on first occurrence', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'ThreeDaysAWeek',
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: yesterday,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate =
        await schedulerService.shouldCreateThreeDaysAWeekTask(
          parentTask,
          mockDate
        );
      expect(shouldCreate).toBe(true);

      jest.restoreAllMocks();
    });

    test('should create three-days-a-week task when less than 3 instances this week', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'ThreeDaysAWeek',
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: yesterday,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create 2 instances this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const instance1 = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: new Date(startOfWeek.getTime() + 24 * 60 * 60 * 1000) // Monday
      });
      await instance1.save();

      const instance2 = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: new Date(startOfWeek.getTime() + 3 * 24 * 60 * 60 * 1000) // Wednesday
      });
      await instance2.save();

      // Mock current day as Friday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 5); // Friday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate =
        await schedulerService.shouldCreateThreeDaysAWeekTask(
          parentTask,
          mockDate
        );
      expect(shouldCreate).toBe(true);

      jest.restoreAllMocks();
    });

    test('should not create three-days-a-week task when 3 instances already created this week', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'ThreeDaysAWeek',
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: yesterday,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create 3 instances this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const instance1 = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: new Date(startOfWeek.getTime() + 24 * 60 * 60 * 1000) // Monday
      });
      await instance1.save();

      const instance2 = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: new Date(startOfWeek.getTime() + 3 * 24 * 60 * 60 * 1000) // Wednesday
      });
      await instance2.save();

      const instance3 = new Task({
        title: 'Three Days A Week Task',
        description: 'Test three days a week task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: new Date(startOfWeek.getTime() + 5 * 24 * 60 * 60 * 1000) // Friday
      });
      await instance3.save();

      // Mock current day as Friday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 5); // Friday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate =
        await schedulerService.shouldCreateThreeDaysAWeekTask(
          parentTask,
          mockDate
        );
      expect(shouldCreate).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('Monthly Recurring Tasks', () => {
    test('should create monthly task on specific day of month', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const parentTask = new Task({
        title: 'Monthly Task',
        description: 'Test monthly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Monthly',
          monthlyInterval: 1,
          monthlyDayOfMonth: 15,
          startDate: lastMonth,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Mock current date as 15th
      const mockDate = new Date();
      mockDate.setDate(15);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateMonthlyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(true);

      jest.restoreAllMocks();
    });

    test('should create monthly task on specific day of week in month', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const parentTask = new Task({
        title: 'Monthly Task',
        description: 'Test monthly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Monthly',
          monthlyInterval: 1,
          monthlyDayOfWeek: 'first',
          monthlyDay: 'Monday',
          startDate: lastMonth,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Mock current date as first Monday of the month
      const mockDate = new Date();
      mockDate.setDate(1);
      while (mockDate.getDay() !== 1) {
        // Find first Monday
        mockDate.setDate(mockDate.getDate() + 1);
      }
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateMonthlyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(true);

      jest.restoreAllMocks();
    });

    test('should not create monthly task before interval has passed', async () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const parentTask = new Task({
        title: 'Monthly Task',
        description: 'Test monthly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Monthly',
          monthlyInterval: 1,
          monthlyDayOfMonth: 15,
          startDate: twoWeeksAgo,
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create a previous instance
      const lastInstance = new Task({
        title: 'Monthly Task',
        description: 'Test monthly task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        createdAt: twoWeeksAgo
      });
      await lastInstance.save();

      // Mock current date as 15th
      const mockDate = new Date();
      mockDate.setDate(15);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const shouldCreate = await schedulerService.shouldCreateMonthlyTask(
        parentTask,
        mockDate
      );
      expect(shouldCreate).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('End Date and End Count Logic', () => {
    test('should not create task when end date has passed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'End Date Task',
        description: 'Test end date task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: yesterday,
          endType: 'endBy',
          endDate: yesterday
        }
      });
      await parentTask.save();

      const shouldCreate =
        await schedulerService.shouldCreateRecurringTask(parentTask);
      expect(shouldCreate).toBe(false);
    });

    test('should not create task when end count has been reached', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const parentTask = new Task({
        title: 'End Count Task',
        description: 'Test end count task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: yesterday,
          endType: 'endAfter',
          endAfterCount: 2
        }
      });
      await parentTask.save();

      // Create 2 instances (reaching the end count)
      const instance1 = new Task({
        title: 'End Count Task',
        description: 'Test end count task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1
      });
      await instance1.save();

      const instance2 = new Task({
        title: 'End Count Task',
        description: 'Test end count task',
        status: 'Completed',
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1
      });
      await instance2.save();

      const shouldCreate =
        await schedulerService.shouldCreateRecurringTask(parentTask);
      expect(shouldCreate).toBe(false);
    });
  });

  describe('Task Instance Creation', () => {
    test('should create recurring task instance correctly', async () => {
      const parentTask = new Task({
        title: 'Parent Task',
        description: 'Test parent task',
        isRecurring: true,
        createdBy: testUser._id,
        assignedTo: testUser._id,
        assignedToRole: 'admin',
        creditCost: 2,
        dueDate: new Date(),
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: new Date(),
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      const newInstance =
        await schedulerService.createRecurringTaskInstance(parentTask);

      expect(newInstance).toBeDefined();
      expect(newInstance.title).toBe(parentTask.title);
      expect(newInstance.description).toBe(parentTask.description);
      expect(newInstance.status).toBe('Submitted');
      expect(newInstance.createdBy.toString()).toBe(
        parentTask.createdBy.toString()
      );
      expect(newInstance.assignedTo.toString()).toBe(
        parentTask.assignedTo.toString()
      );
      expect(newInstance.assignedToRole).toBe(parentTask.assignedToRole);
      expect(newInstance.creditCost).toBe(parentTask.creditCost);
      expect(newInstance.parentTaskId.toString()).toBe(
        parentTask._id.toString()
      );
      expect(newInstance.isRecurring).toBe(false);
      expect(newInstance.files).toEqual([]);
    });

    test('should update parent task recurrenceId on first instance', async () => {
      const parentTask = new Task({
        title: 'Parent Task',
        description: 'Test parent task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: new Date(),
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      expect(parentTask.recurrenceId).toBeUndefined();

      const newInstance =
        await schedulerService.createRecurringTaskInstance(parentTask);

      // Refresh parent task from database
      const updatedParentTask = await Task.findById(parentTask._id);
      expect(updatedParentTask.recurrenceId.toString()).toBe(
        newInstance._id.toString()
      );
    });
  });

  describe('Integration Tests', () => {
    test('should process all recurring tasks correctly', async () => {
      // Create multiple recurring tasks
      const dailyTask = new Task({
        title: 'Daily Task',
        description: 'Test daily task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          endType: 'noEnd'
        }
      });
      await dailyTask.save();

      const weeklyTask = new Task({
        title: 'Weekly Task',
        description: 'Test weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Weekly',
          weeklyInterval: 1,
          weeklyDays: ['Monday'],
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          endType: 'noEnd'
        }
      });
      await weeklyTask.save();

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await schedulerService.processRecurringTasks();

      // Check that instances were created
      const dailyInstances = await Task.find({ parentTaskId: dailyTask._id });
      const weeklyInstances = await Task.find({ parentTaskId: weeklyTask._id });

      expect(dailyInstances.length).toBe(1);
      expect(weeklyInstances.length).toBe(1);

      jest.restoreAllMocks();
    });

    test('should handle tasks with no parent task ID filter', async () => {
      // Create a parent task
      const parentTask = new Task({
        title: 'Parent Task',
        description: 'Test parent task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      // Create a child task (should not be processed)
      const childTask = new Task({
        title: 'Child Task',
        description: 'Test child task',
        isRecurring: true,
        createdBy: testUser._id,
        parentTaskId: parentTask._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endType: 'noEnd'
        }
      });
      await childTask.save();

      await schedulerService.processRecurringTasks();

      // Only the parent task should have instances created
      const parentInstances = await Task.find({ parentTaskId: parentTask._id });
      const childInstances = await Task.find({ parentTaskId: childTask._id });

      expect(parentInstances.length).toBe(1);
      expect(childInstances.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle task with no recurring settings', async () => {
      const parentTask = new Task({
        title: 'No Settings Task',
        description: 'Test task with no settings',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1
      });
      await parentTask.save();

      const shouldCreate =
        await schedulerService.shouldCreateRecurringTask(parentTask);
      expect(shouldCreate).toBe(false);
    });

    test('should handle task with unknown pattern', async () => {
      const parentTask = new Task({
        title: 'Unknown Pattern Task',
        description: 'Test task with unknown pattern',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'UnknownPattern',
          startDate: new Date(),
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      const shouldCreate =
        await schedulerService.shouldCreateRecurringTask(parentTask);
      expect(shouldCreate).toBe(false);
    });

    test('should handle weekly task with no weekly days specified', async () => {
      const parentTask = new Task({
        title: 'No Days Task',
        description: 'Test weekly task with no days',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Weekly',
          weeklyInterval: 1,
          weeklyDays: [],
          startDate: new Date(),
          endType: 'noEnd'
        }
      });
      await parentTask.save();

      const shouldCreate = await schedulerService.shouldCreateWeeklyTask(
        parentTask,
        new Date()
      );
      expect(shouldCreate).toBe(false);
    });
  });
});
