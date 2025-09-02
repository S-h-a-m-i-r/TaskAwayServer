import mongoose from 'mongoose';
import { jest } from '@jest/globals';

// Import the functions we want to test
import { updateTaskService } from '../../../src/services/tasksService.js';
import Task from '../../../src/models/Task.js';
import TaskHistory from '../../../src/models/TaskHistory.js';

// Mock the models
jest.mock('../../../src/models/Task.js');
jest.mock('../../../src/models/TaskHistory.js');

describe('Task Service - Recurring Tasks', () => {
  // Setup before each test
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock implementation for mongoose methods
    Task.findByIdAndUpdate = jest.fn();
    Task.create = jest.fn();
    TaskHistory.create = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // Test case: When a recurring task is closed, a new task should be created
  test('should create a new task when a recurring task is closed', async () => {
    // Mock data
    const taskId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : '507f1f77bcf86cd799439011';
    const userId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : '507f1f77bcf86cd799439012';
    
    const mockTask = {
      _id: taskId,
      title: 'Recurring Task Test',
      description: 'This is a test for recurring tasks',
      status: 'Closed',
      createdBy: userId,
      assignedTo: userId,
      assignedToRole: 'CUSTOMER',
      creditCost: 1,
      isRecurring: true,
      recurrencePattern: 'Weekly',
      dueDate: new Date('2025-08-25T12:00:00Z'), // Previous due date
      recurrenceEndDate: new Date('2025-12-31T12:00:00Z'), // End date in the future
      files: []
    };
    
    // Mock the newly created task
    const mockNewTask = {
      _id: mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : '507f1f77bcf86cd799439013',
      ...mockTask,
      status: 'Submitted',
      dueDate: new Date('2025-09-01T12:00:00Z'), // Next due date (weekly)
      parentTaskId: taskId
    };
    
    // Set up the mocks
    Task.findByIdAndUpdate.mockResolvedValue(mockTask);
    Task.create.mockResolvedValue(mockNewTask);
    TaskHistory.create.mockResolvedValue({});
    
    // Call the function with the update to close the task
    const result = await updateTaskService(taskId.toString(), { status: 'Closed' });
    
    // Assertions
    expect(Task.findByIdAndUpdate).toHaveBeenCalledWith(
      taskId.toString(), 
      { status: 'Closed' }, 
      { new: true }
    );
    
    // Check that a new task was created with correct properties
    expect(Task.create).toHaveBeenCalledTimes(1);
    expect(Task.create).toHaveBeenCalledWith(expect.objectContaining({
      title: mockTask.title,
      description: mockTask.description,
      status: 'Submitted', // Should start as submitted
      createdBy: mockTask.createdBy,
      assignedTo: mockTask.assignedTo,
      assignedToRole: mockTask.assignedToRole,
      isRecurring: true,
      recurrencePattern: mockTask.recurrencePattern,
      recurrenceEndDate: mockTask.recurrenceEndDate,
    }));
    
    // Verify TaskHistory was created for the recurring event
    expect(TaskHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      taskId: mockNewTask._id,
      currentlyAssignedUserId: mockTask.assignedTo,
      currentlyAssignedUserRole: mockTask.assignedToRole,
      isRecurringEvent: true,
      parentTaskId: mockTask._id,
    }));
  });

  // Test case: When a recurring task is closed but recurrenceEndDate is passed, no new task should be created
  test('should not create a new task when a recurring task is closed but end date is in the past', async () => {
    // Mock data
    const taskId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : '507f1f77bcf86cd799439014';
    const userId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : '507f1f77bcf86cd799439015';
    
    const mockTask = {
      _id: taskId,
      title: 'Recurring Task Test',
      description: 'This is a test for recurring tasks',
      status: 'Closed',
      createdBy: userId,
      assignedTo: userId,
      assignedToRole: 'CUSTOMER',
      creditCost: 1,
      isRecurring: true,
      recurrencePattern: 'Weekly',
      dueDate: new Date('2025-08-25T12:00:00Z'), // Previous due date
      recurrenceEndDate: new Date('2025-08-30T12:00:00Z'), // End date in the past
      files: []
    };
    
    // Set up the mocks
    Task.findByIdAndUpdate.mockResolvedValue(mockTask);
    
    // Call the function with the update to close the task
    const result = await updateTaskService(taskId.toString(), { status: 'Closed' });
    
    // Assertions
    expect(Task.findByIdAndUpdate).toHaveBeenCalledWith(
      taskId.toString(), 
      { status: 'Closed' }, 
      { new: true }
    );
    
    // Check that no new task was created
    expect(Task.create).not.toHaveBeenCalled();
    expect(TaskHistory.create).not.toHaveBeenCalled();
  });

  // Test case: Test different recurrence patterns
  test('should correctly calculate next due date based on recurrence pattern', async () => {
    // Test cases for different recurrence patterns
    const testCases = [
      {
        pattern: 'Daily',
        startDate: new Date('2025-09-01T12:00:00Z'),
        expectedNextDate: new Date('2025-09-02T12:00:00Z'),
      },
      {
        pattern: 'Weekly',
        startDate: new Date('2025-09-01T12:00:00Z'),
        expectedNextDate: new Date('2025-09-08T12:00:00Z'),
      },
      {
        pattern: 'Monthly',
        startDate: new Date('2025-09-01T12:00:00Z'),
        expectedNextDate: new Date('2025-10-01T12:00:00Z'),
      },
    ];
    
    for (const testCase of testCases) {
      // Mock data
      const taskId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : `507f1f77bcf86cd7994390${testCases.indexOf(testCase)}`;
      const userId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : `507f1f77bcf86cd7994391${testCases.indexOf(testCase)}`;
      
      const mockTask = {
        _id: taskId,
        title: `${testCase.pattern} Recurring Task`,
        description: `Testing ${testCase.pattern} recurrence`,
        status: 'Closed',
        createdBy: userId,
        assignedTo: userId,
        assignedToRole: 'CUSTOMER',
        creditCost: 1,
        isRecurring: true,
        recurrencePattern: testCase.pattern,
        dueDate: testCase.startDate,
        recurrenceEndDate: new Date('2025-12-31T12:00:00Z'),
        files: []
      };
      
      // Set up the mocks for this iteration
      Task.findByIdAndUpdate.mockResolvedValue(mockTask);
      Task.create.mockImplementation(data => Promise.resolve({
        _id: mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : `507f1f77bcf86cd7994392${testCases.indexOf(testCase)}`,
        ...data
      }));
      
      // Call the function
      await updateTaskService(taskId.toString(), { status: 'Closed' });
      
      // Get the call arguments for Task.create
      const createCallArgs = Task.create.mock.calls[0][0];
      
      // Check that the due date was calculated correctly
      expect(createCallArgs.dueDate.toISOString()).toBe(
        testCase.expectedNextDate.toISOString()
      );
      
      // Reset mocks for next iteration
      jest.clearAllMocks();
    }
  });

  // Test case: Non-recurring tasks should not create new tasks
  test('should not create a new task when a non-recurring task is closed', async () => {
    // Mock data
    const taskId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : '507f1f77bcf86cd799439016';
    const userId = mongoose.Types.ObjectId ? new mongoose.Types.ObjectId() : '507f1f77bcf86cd799439017';
    
    const mockTask = {
      _id: taskId,
      title: 'Non-Recurring Task',
      description: 'This is a regular task',
      status: 'Closed',
      createdBy: userId,
      assignedTo: userId,
      assignedToRole: 'CUSTOMER',
      creditCost: 1,
      isRecurring: false, // Not a recurring task
      files: []
    };
    
    // Set up the mocks
    Task.findByIdAndUpdate.mockResolvedValue(mockTask);
    
    // Call the function
    const result = await updateTaskService(taskId.toString(), { status: 'Closed' });
    
    // Check that no new task was created
    expect(Task.create).not.toHaveBeenCalled();
    expect(TaskHistory.create).not.toHaveBeenCalled();
  });
});