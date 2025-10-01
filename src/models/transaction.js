import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'usd'
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionType: {
      type: String,
      enum: ['subscription', 'credit_purchase', 'refund', 'other'],
      required: true
    },
    stripeTransactionId: {
      type: String,
      default: null
    },
    subscriptionId: {
        type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Use explicit connection to avoid buffering issues
const Transaction = mongoose.connection.model('Transaction', transactionSchema);
export default Transaction;