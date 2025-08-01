import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true }, // Stores S3 URL (e.g., https://taskaway-bucket.s3.amazonaws.com/tasks/12345-file.pdf)
  size: { type: Number, required: true }, // In bytes
  type: { 
    type: String, 
    required: false,
    enum: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'], // Restrict file types (adjust as needed)
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
      enum: ['Submitted', 'InProgress', 'Completed', 'Closed', 'Pending'],
      default: 'Pending'
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
