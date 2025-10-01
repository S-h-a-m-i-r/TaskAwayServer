import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  fileKey: { type: String, required: true }, // S3 object key (e.g., temp/1234567890-file.pdf)
  url: { type: String, required: true }, // Stores S3 URL (e.g., https://taskaway-bucket.s3.amazonaws.com/tasks/12345-file.pdf)
  size: { type: Number, required: true }, // In bytes
  type: { 
    type: String, 
    required: false,
    enum: [
      'application/pdf',
      'image/jpeg', 
      'image/jpg',
      'image/png', 
      'image/webp',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ], // Restrict file types (adjust as needed)
  },
  uploadedAt: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['Submitted', 'InProgress', 'Completed', 'Closed'],
      default: 'Submitted'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    assignedToRole: {
      type: String,
      required: false
    },
    creditCost: {
      type: Number,
      enum: [1, 2],
      required: true,
      default: 1
    },
    // Recurrence-related fields
    isRecurring: { type: Boolean, default: false },
    recurrencePattern: {
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly'],
      required: false
    },
    recurrenceEndDate: { type: Date, required: false }, // when recurrence should stop
    recurrenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: false
    },
    dueDate: { type: Date, required: false },

    // Detailed recurring settings from frontend
    recurringSettings: {
      pattern: {
        type: String,
        enum: ['Daily', 'Weekly', 'Monthly'],
        required: false
      },
      dailyInterval: { type: Number, required: false },
      weeklyInterval: { type: Number, required: false },
      weeklyDays: [
        {
          type: String,
          enum: [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
          ]
        }
      ],
      monthlyInterval: { type: Number, required: false },
      monthlyDayOfWeek: {
        type: String,
        enum: ['first', 'second', 'third', 'fourth', 'last'],
        required: false
      },
      monthlyDay: {
        type: String,
        enum: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday'
        ],
        required: false
      },
      monthlyDayOfMonth: { type: Number, required: false },
      startDate: { type: Date, required: false },
      endType: {
        type: String,
        enum: ['endBy', 'endAfter', 'noEnd'],
        required: false
      },
      endDate: { type: Date, required: false },
      endAfterCount: { type: Number, required: false }
    },

    // Additional fields for task relationships
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: false
    },
    files: {
      type: [fileSchema],
      validate: [
        {
          validator: function (val) {
            return val.length <= 12;
          },
          message: 'A maximum of 12 files are allowed.'
        },
        {
          validator: function (val) {
            const totalSize = val.reduce((acc, f) => acc + f.size, 0);
            return totalSize <= 60 * 1024 * 1024; // 60MB
          },
          message: 'Total file size exceeds 60MB.'
        }
      ]
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Task', taskSchema);
