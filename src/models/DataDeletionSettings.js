import mongoose from 'mongoose';

const dataDeletionSettingsSchema = new mongoose.Schema(
  {
    schedulePeriod: {
      type: String,
      enum: ['1month', '2months', '3months'],
      required: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastExecutionDate: {
      type: Date,
      required: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one active setting exists
dataDeletionSettingsSchema.index(
  { isActive: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model(
  'DataDeletionSettings',
  dataDeletionSettingsSchema
);
