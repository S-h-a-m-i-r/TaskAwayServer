import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/server.js';
import Task from '../../src/models/Task.js';
import User from '../../src/models/User.js';
import SchedulerService from '../../src/services/schedulerService.js';

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

describe('Scheduler Integration Tests', () => {
  let testUser;
  let authToken;

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

    // Generate auth token (simplified for testing)
    authToken = 'test-token';
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Daily Recurring Task Creation and Processing', () => {
    test('should create daily recurring task and process it correctly', async () => {
      // Create a daily recurring task
      const taskData = {
        title: 'Daily Standup',
        description: 'Daily team standup meeting',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const parentTask = await Task.findById(response.body.task._id);
      expect(parentTask.isRecurring).toBe(true);
      expect(parentTask.recurringSettings.pattern).toBe('Daily');

      // Process recurring tasks
      await SchedulerService.processRecurringTasks();

      // Check that an instance was created
      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(1);
      expect(instances[0].title).toBe(parentTask.title);
      expect(instances[0].isRecurring).toBe(false);
    });

    test('should create daily recurring task with custom interval', async () => {
      const taskData = {
        title: 'Every 3 Days Task',
        description: 'Task that runs every 3 days',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 3,
          startDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);
      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(1);
    });
  });

  describe('Weekly Recurring Task Creation and Processing', () => {
    test('should create weekly recurring task and process it correctly', async () => {
      const taskData = {
        title: 'Weekly Team Meeting',
        description: 'Weekly team sync meeting',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Weekly',
          weeklyInterval: 1,
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(1);

      jest.restoreAllMocks();
    });
  });

  describe('Bi-Weekly Recurring Task Creation and Processing', () => {
    test('should create bi-weekly recurring task and process it correctly', async () => {
      const taskData = {
        title: 'Bi-Weekly Sprint Planning',
        description: 'Sprint planning meeting every two weeks',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'BiWeekly',
          weeklyDays: ['Monday'],
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(1);

      jest.restoreAllMocks();
    });
  });

  describe('Three Days A Week Recurring Task Creation and Processing', () => {
    test('should create three-days-a-week recurring task and process it correctly', async () => {
      const taskData = {
        title: 'Three Days A Week Task',
        description: 'Task that runs three days a week',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'ThreeDaysAWeek',
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(1);

      jest.restoreAllMocks();
    });

    test('should limit three-days-a-week task to 3 instances per week', async () => {
      const taskData = {
        title: 'Three Days A Week Task',
        description: 'Task that runs three days a week',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'ThreeDaysAWeek',
          weeklyDays: ['Monday', 'Wednesday', 'Friday'],
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      const parentTask = await Task.findById(response.body.task._id);

      // Create 3 instances this week manually
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      for (let i = 0; i < 3; i++) {
        const instance = new Task({
          title: 'Three Days A Week Task',
          description: 'Task that runs three days a week',
          status: 'Completed',
          createdBy: testUser._id,
          parentTaskId: parentTask._id,
          creditCost: 1,
          createdAt: new Date(
            startOfWeek.getTime() + (i * 2 + 1) * 24 * 60 * 60 * 1000
          )
        });
        await instance.save();
      }

      // Mock current day as Friday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 5); // Friday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(3); // Should not create a 4th instance

      jest.restoreAllMocks();
    });
  });

  describe('Monthly Recurring Task Creation and Processing', () => {
    test('should create monthly recurring task with specific day of month', async () => {
      const taskData = {
        title: 'Monthly Report',
        description: 'Monthly report generation',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Monthly',
          monthlyInterval: 1,
          monthlyDayOfMonth: 15,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last month
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);

      // Mock current date as 15th
      const mockDate = new Date();
      mockDate.setDate(15);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(1);

      jest.restoreAllMocks();
    });

    test('should create monthly recurring task with specific day of week in month', async () => {
      const taskData = {
        title: 'Monthly Review',
        description: 'Monthly team review meeting',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Monthly',
          monthlyInterval: 1,
          monthlyDayOfWeek: 'first',
          monthlyDay: 'Monday',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last month
          endType: 'noEnd'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);

      // Mock current date as first Monday of the month
      const mockDate = new Date();
      mockDate.setDate(1);
      while (mockDate.getDay() !== 1) {
        // Find first Monday
        mockDate.setDate(mockDate.getDate() + 1);
      }
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(1);

      jest.restoreAllMocks();
    });
  });

  describe('End Date and End Count Scenarios', () => {
    test('should stop creating instances when end date is reached', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const taskData = {
        title: 'Limited Duration Task',
        description: 'Task with end date',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: yesterday,
          endType: 'endBy',
          endDate: yesterday
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);
      await SchedulerService.processRecurringTasks();

      const instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(0); // Should not create any instances
    });

    test('should stop creating instances when end count is reached', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const taskData = {
        title: 'Limited Count Task',
        description: 'Task with end count',
        isRecurring: true,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Daily',
          dailyInterval: 1,
          startDate: yesterday,
          endType: 'endAfter',
          endAfterCount: 2
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);

      const parentTask = await Task.findById(response.body.task._id);

      // Process twice to create 2 instances
      await SchedulerService.processRecurringTasks();
      await SchedulerService.processRecurringTasks();

      let instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(2);

      // Process again - should not create more instances
      await SchedulerService.processRecurringTasks();

      instances = await Task.find({ parentTaskId: parentTask._id });
      expect(instances.length).toBe(2);
    });
  });

  describe('Multiple Recurring Tasks Processing', () => {
    test('should process multiple different types of recurring tasks', async () => {
      // Create daily task
      const dailyTask = new Task({
        title: 'Daily Task',
        description: 'Daily task',
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
      await dailyTask.save();

      // Create weekly task
      const weeklyTask = new Task({
        title: 'Weekly Task',
        description: 'Weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'Weekly',
          weeklyInterval: 1,
          weeklyDays: ['Monday'],
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endType: 'noEnd'
        }
      });
      await weeklyTask.save();

      // Create bi-weekly task
      const biWeeklyTask = new Task({
        title: 'Bi-Weekly Task',
        description: 'Bi-weekly task',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'BiWeekly',
          weeklyDays: ['Monday'],
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          endType: 'noEnd'
        }
      });
      await biWeeklyTask.save();

      // Mock current day as Monday
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - mockDate.getDay() + 1); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await SchedulerService.processRecurringTasks();

      // Check that instances were created for all tasks
      const dailyInstances = await Task.find({ parentTaskId: dailyTask._id });
      const weeklyInstances = await Task.find({ parentTaskId: weeklyTask._id });
      const biWeeklyInstances = await Task.find({
        parentTaskId: biWeeklyTask._id
      });

      expect(dailyInstances.length).toBe(1);
      expect(weeklyInstances.length).toBe(1);
      expect(biWeeklyInstances.length).toBe(1);

      jest.restoreAllMocks();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully during processing', async () => {
      // Create a task with invalid settings
      const invalidTask = new Task({
        title: 'Invalid Task',
        description: 'Task with invalid settings',
        isRecurring: true,
        createdBy: testUser._id,
        creditCost: 1,
        recurringSettings: {
          pattern: 'InvalidPattern',
          startDate: new Date(),
          endType: 'noEnd'
        }
      });
      await invalidTask.save();

      // This should not throw an error
      await expect(
        SchedulerService.processRecurringTasks()
      ).resolves.not.toThrow();

      // No instances should be created
      const instances = await Task.find({ parentTaskId: invalidTask._id });
      expect(instances.length).toBe(0);
    });
  });
});
