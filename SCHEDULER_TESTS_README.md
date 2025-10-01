# Scheduler Tests Documentation

This document describes the comprehensive test suite for the TaskAway recurring task scheduler.

## Overview

The scheduler handles the automatic creation of recurring task instances based on various patterns:
- **Daily**: Every day or every N days
- **Weekly**: Every week on specified days
- **Bi-Weekly**: Every 2 weeks on specified days
- **Three Days A Week**: Up to 3 times per week on specified days
- **Monthly**: Every month on specific dates or day-of-week patterns

## Test Files

### 1. Unit Tests (`tests/unit/services/schedulerService.test.js`)

Comprehensive unit tests covering all scheduler functionality:

#### Daily Pattern Tests
- ✅ First instance creation when start date has passed
- ✅ No creation when start date hasn't passed
- ✅ Creation after interval has passed
- ✅ No creation before interval has passed
- ✅ Custom interval handling (every 2 days, 3 days, etc.)

#### Weekly Pattern Tests
- ✅ Creation on specified days
- ✅ No creation on non-specified days
- ✅ Creation after weekly interval has passed
- ✅ Multiple days per week support

#### Bi-Weekly Pattern Tests
- ✅ Creation on specified day after 2 weeks
- ✅ No creation before 2 weeks have passed
- ✅ Proper interval calculation

#### Three Days A Week Pattern Tests
- ✅ First occurrence creation
- ✅ Creation when less than 3 instances this week
- ✅ No creation when 3 instances already created this week
- ✅ Week boundary handling

#### Monthly Pattern Tests
- ✅ Creation on specific day of month (e.g., 15th)
- ✅ Creation on specific day of week in month (e.g., first Monday)
- ✅ No creation before monthly interval has passed
- ✅ Complex day-of-week calculations

#### End Date and End Count Tests
- ✅ No creation when end date has passed
- ✅ No creation when end count has been reached
- ✅ Proper counting of instances

#### Task Instance Creation Tests
- ✅ Correct instance properties
- ✅ Parent task recurrenceId update
- ✅ Proper inheritance of task properties

#### Edge Cases
- ✅ Tasks with no recurring settings
- ✅ Unknown patterns
- ✅ Weekly tasks with no days specified
- ✅ Error handling

### 2. Integration Tests (`tests/integration/scheduler.test.js`)

End-to-end tests that test the scheduler through the API:

#### API Integration
- ✅ Daily task creation and processing
- ✅ Weekly task creation and processing
- ✅ Bi-weekly task creation and processing
- ✅ Three days a week task creation and processing
- ✅ Monthly task creation and processing

#### End Date/Count Scenarios
- ✅ End date enforcement
- ✅ End count enforcement
- ✅ Multiple task processing

#### Error Handling
- ✅ Graceful error handling
- ✅ Invalid pattern handling

### 3. Manual Test Script (`test-scheduler-comprehensive.js`)

A comprehensive manual test script that creates all types of recurring tasks and processes them:

#### Test Tasks Created
1. **Daily Task**: Runs every day
2. **Every 2 Days Task**: Runs every 2 days
3. **Weekly Task**: Runs every Monday
4. **Weekly Multi-Day Task**: Runs on Monday, Wednesday, Friday
5. **Bi-Weekly Task**: Runs every 2 weeks on Monday
6. **Three Days A Week Task**: Runs up to 3 times per week
7. **Monthly Task (Day of Month)**: Runs on the 15th of every month
8. **Monthly Task (Day of Week)**: Runs on the first Monday of every month
9. **End Date Task**: Stops after a specific date
10. **End Count Task**: Stops after 3 instances

## Running the Tests

### Prerequisites
- MongoDB running locally or accessible via `MONGODB_URI`
- Node.js and npm installed
- Test database configured

### Commands

```bash
# Run all tests
npm test

# Run only scheduler unit tests
npm run test:scheduler:unit

# Run only scheduler integration tests
npm run test:scheduler:integration

# Run comprehensive manual test
npm run test:scheduler

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Environment Variables

Set these environment variables for testing:

```bash
# For unit tests
MONGODB_TEST_URI=mongodb://localhost:27017/taskaway_test

# For integration tests
MONGODB_URI=mongodb://localhost:27017/taskaway
```

## Test Coverage

The test suite covers:

- ✅ All recurring patterns (Daily, Weekly, Bi-Weekly, Three Days A Week, Monthly)
- ✅ All interval configurations
- ✅ All end conditions (end date, end count, no end)
- ✅ Edge cases and error conditions
- ✅ Task instance creation and properties
- ✅ Parent-child task relationships
- ✅ Timezone handling
- ✅ Week boundary calculations
- ✅ Month boundary calculations
- ✅ Complex day-of-week calculations

## New Patterns Added

### Bi-Weekly Pattern
- Runs every 2 weeks on specified days
- Uses `weeklyDays` array to specify target days
- Calculates 2-week intervals from last instance

### Three Days A Week Pattern
- Runs up to 3 times per week on specified days
- Tracks instances per week
- Resets count at week boundaries
- Uses `weeklyDays` array to specify target days

## Scheduler Service Updates

### New Methods Added
- `shouldCreateBiWeeklyTask()`: Handles bi-weekly logic
- `shouldCreateThreeDaysAWeekTask()`: Handles three-days-a-week logic

### Updated Methods
- `shouldCreateRecurringTask()`: Added new pattern cases
- Task model: Added new pattern enums
- Tasks service: Added new pattern calculations

## Database Schema Updates

### Task Model Changes
```javascript
recurrencePattern: {
  type: String,
  enum: ['Daily', 'Weekly', 'BiWeekly', 'ThreeDaysAWeek', 'Monthly'],
  required: false
}

recurringSettings: {
  pattern: {
    type: String,
    enum: ['Daily', 'Weekly', 'BiWeekly', 'ThreeDaysAWeek', 'Monthly'],
    required: false
  }
  // ... other settings remain the same
}
```

## Troubleshooting

### Common Issues

1. **Tests failing due to timezone differences**
   - Ensure consistent timezone handling in tests
   - Use UTC dates for consistency

2. **MongoDB connection issues**
   - Check MongoDB is running
   - Verify connection string
   - Ensure test database is accessible

3. **Date mocking issues**
   - Properly restore mocks after tests
   - Use consistent date formats

4. **Test data cleanup**
   - Tests clean up after themselves
   - Manual test script creates isolated test data

### Debug Tips

1. Enable console logging in tests to see scheduler output
2. Check database for created instances
3. Verify task settings and dates
4. Use the manual test script for debugging

## Future Enhancements

Potential improvements for the scheduler:

1. **Yearly Pattern**: Add yearly recurring tasks
2. **Custom Patterns**: Allow custom recurrence patterns
3. **Time-based Scheduling**: Schedule tasks for specific times
4. **Holiday Handling**: Skip tasks on holidays
5. **Timezone Support**: Better timezone handling
6. **Performance Optimization**: Batch processing for large numbers of tasks
7. **Retry Logic**: Retry failed task creation
8. **Monitoring**: Add metrics and monitoring

## Contributing

When adding new patterns or features:

1. Add unit tests for the new functionality
2. Add integration tests
3. Update the manual test script
4. Update this documentation
5. Ensure all tests pass
6. Test with real data scenarios
