// services/eventService.js
import Transaction from '../models/transaction.js';
import Subscription from '../models/subscription.js';
import User from '../models/User.js';
import { addCredits } from './creditsService.js';
import notificationService from './notificationService.js';
import { EventEmitter } from 'node:events';

const eventEmitter = new EventEmitter();
export default eventEmitter;

export function initEventListeners() {
  // Subscription created
  eventEmitter.on('subscription.created', async (data) => {
    try {
      const { userId } = data;

      const startDate = data.currentPeriodStart
        ? data.currentPeriodStart
        : new Date();

      const endDate = data.currentPeriodEnd
        ? data.currentPeriodEnd
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      console.log('🔄 Using dates:', {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });
      const subscription = await Subscription.create({
        user: data.userId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        planType: data.planType,
        amount: data.amount || 0,
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        status: data.status || 'active',
        metadata: data.metadata || {}
      });
      await User.findByIdAndUpdate(data.userId, {
        activeSubscription: subscription._id,
        subscriptionStatus: data.status || 'active',
        planType: data.planType
      });

      console.log(`✅ Subscription created processed for user ${userId}`);
    } catch (err) {
      console.error('❌ Error subscription.created:', err);
    }
  });

  // Subscription updated
  eventEmitter.on('subscription.updated', async (data) => {
    try {
      const {
        userId,
        stripeSubscriptionId,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        canceledAt
      } = data;
      const subscription = await Subscription.findOne({ stripeSubscriptionId });

      if (!subscription) {
        console.warn(`⚠️ No subscription found for ${stripeSubscriptionId}`);
        return;
      }

      subscription.status = status;
      if (currentPeriodStart)
        subscription.currentPeriodStart = new Date(currentPeriodStart * 1000);
      if (currentPeriodEnd)
        subscription.currentPeriodEnd = new Date(currentPeriodEnd * 1000);
      if (cancelAtPeriodEnd !== undefined)
        subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
      if (canceledAt) subscription.canceledAt = new Date(canceledAt * 1000);
      await subscription.save();

      await User.findByIdAndUpdate(userId, { subscriptionStatus: status });
      console.log(`✅ Subscription updated for user ${userId}`);
    } catch (err) {
      console.error('❌ Error subscription.updated:', err);
    }
  });

  // Payment succeeded
  eventEmitter.on('payment.succeeded', async (data) => {
    try {
      const {
        userId,
        amount,
        stripeTransactionId,
        subscriptionId,
        description,
        metadata = {}
      } = data;

      await Transaction.create({
        user: userId,
        amount,
        description,
        status: 'completed',
        transactionType: subscriptionId ? 'subscription' : 'credit_purchase',
        stripeTransactionId,
        subscriptionId,
        metadata
      });

      if (subscriptionId && metadata.planType === '10_CREDITS') {
        await addCredits(userId, 10, 'Monthly Subscription');
        console.log(`✅ Added 10 credits to user ${userId}`);
      }

      console.log(`✅ Payment succeeded for user ${userId}`);
    } catch (err) {
      console.error('❌ Error payment.succeeded:', err);
    }
  });

  // Payment failed
  eventEmitter.on('payment.failed', async (data) => {
    try {
      const {
        userId,
        amount,
        stripeTransactionId,
        subscriptionId,
        description,
        metadata = {}
      } = data;

      await Transaction.create({
        user: userId,
        amount,
        description: description || 'Payment failed',
        status: 'failed',
        transactionType: subscriptionId ? 'subscription' : 'credit_purchase',
        stripeTransactionId,
        subscriptionId,
        metadata
      });

      console.log(`⚠️ Payment failed for user ${userId}`);
    } catch (err) {
      console.error('❌ Error payment.failed:', err);
    }
  });

  // ==================== NOTIFICATION EVENTS ====================

  // Task created notification
  eventEmitter.on('task.created', async (data) => {
    try {
      await notificationService.handleTaskCreated(data);
    } catch (err) {
      console.error('❌ Error task.created notification:', err);
    }
  });

  // New message notification
  eventEmitter.on('message.sent', async (data) => {
    try {
      await notificationService.handleNewMessage(data);
    } catch (err) {
      console.error('❌ Error message.sent notification:', err);
    }
  });

  // Task assigned notification
  eventEmitter.on('task.assigned', async (data) => {
    try {
      await notificationService.handleTaskAssigned(data);
    } catch (err) {
      console.error('❌ Error task.assigned notification:', err);
    }
  });

  // Task status changed notification
  eventEmitter.on('task.statusChanged', async (data) => {
    try {
      await notificationService.handleTaskStatusChanged(data);
    } catch (err) {
      console.error('❌ Error task.statusChanged notification:', err);
    }
  });
}
