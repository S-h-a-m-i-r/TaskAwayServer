import mongoose from 'mongoose';
const messageSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // ✅ not 'Users'
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
 timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);