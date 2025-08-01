import mongoose from 'mongoose';
import { ROLES } from '../utils/utilityEnums.js';

const taskHistorySchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true
    },
    kickingOutUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    kickingOutUserRole: {
      type: String,
      enum: ROLES
    },
    currentlyAssignedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    currentlyAssignedUserRole: {
      type: String,
      enum: ROLES
    },
  },
  {
    timestamps: true
  }
);

export default mongoose.model('TaskHistory', taskHistorySchema);