// controllers/stripeController.js
import eventEmitter from '../services/eventService.js';

export const stripeWebhookHandler = async (req, res) => {
  const event = req.body;
  try {
    switch (event.type) {
        case 'customer.subscription.created':
            // Fix timestamp conversion and add fallback for planType
            const subscription = event.data.object;
            
            // Safely extract planType
            let planType = '10_CREDITS'; // Default fallback
            
            // Try to get planType from metadata first (most reliable)
            if (subscription.metadata && subscription.metadata.planType) {
              planType = subscription.metadata.planType;
            } 
            // Otherwise try to get it from the price's nickname
            else if (subscription.items.data[0].price.nickname) {
              planType = subscription.items.data[0].price.nickname;
            }
            
            // Convert Unix timestamps to JavaScript Date objects
            const periodStartUnix = subscription.current_period_start || subscription.items.data[0]?.current_period_start;
            const periodEndUnix   = subscription.current_period_end   || subscription.items.data[0]?.current_period_end;
          
            const currentPeriodStart = periodStartUnix ? new Date(periodStartUnix * 1000) : null;
            const currentPeriodEnd   = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
            
            console.log('📅 Date conversion check:', {
              startTimestamp: subscription.current_period_start,
              convertedStart: currentPeriodStart.toISOString(),
              endTimestamp: subscription.current_period_end,
              convertedEnd: currentPeriodEnd.toISOString()
            });
    
            eventEmitter.emit('subscription.created', {
              userId: subscription.metadata.userId,
              stripeSubscriptionId: subscription.id,
              planType: planType,
              amount: subscription.items.data[0].price.unit_amount / 100,
              currentPeriodStart: currentPeriodStart,
              currentPeriodEnd: currentPeriodEnd,
              status: subscription.status,
              metadata: subscription.metadata || {}
            });
            break;
    
          case 'customer.subscription.updated':
            const updatedSub = event.data.object;
            eventEmitter.emit('subscription.updated', {
              userId: updatedSub.metadata.userId,
              stripeSubscriptionId: updatedSub.id,
              status: updatedSub.status,
              currentPeriodStart: new Date(updatedSub.current_period_start * 1000),
              currentPeriodEnd: new Date(updatedSub.current_period_end * 1000),
              cancelAtPeriodEnd: updatedSub.cancel_at_period_end,
              canceledAt: updatedSub.canceled_at ? new Date(updatedSub.canceled_at * 1000) : null
            });
            break;
    

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
              
                const subscriptionId =
                  invoice.subscription ||
                  invoice.lines?.data[0]?.parent?.subscription_item_details?.subscription;
              
                if (!subscriptionId) {
                  console.error('❌ No subscription ID in payment succeeded event');
                  break;
                }
              
                // Try getting metadata from invoice line (faster than API call)
                let userId = invoice.lines?.data[0]?.metadata?.userId;
                let planType = invoice.lines?.data[0]?.metadata?.planType;
              
                if (!userId) {
                  try {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    userId = subscription.metadata?.userId || null;
                    planType = subscription.metadata?.planType || planType;
                  } catch (stripeError) {
                    console.error('❌ Error retrieving subscription:', stripeError);
                  }
                }
              
                if (!userId) {
                  console.error('❌ Missing userId metadata for subscription:', subscriptionId);
                  break;
                }
              
                eventEmitter.emit('payment.succeeded', {
                  userId,
                  amount: invoice.amount_paid / 100,
                  stripeTransactionId: invoice.id || invoice.payment_intent || null,
                  subscriptionId,
                  description: 'Subscription added payment succeeded',
                  metadata: {
                    ...invoice.metadata,
                    planType,
                  },
                });
            }              
            break;
    
          case 'invoice.payment_failed':
            // Similar fix for payment_failed
            if (event.data.object.subscription) {
              try {
                const subscription = await stripe.subscriptions.retrieve(
                  event.data.object.subscription
                );
                
                if (subscription && subscription.metadata && subscription.metadata.userId) {
                  eventEmitter.emit('payment.failed', {
                    userId: subscription.metadata.userId,
                    amount: event.data.object.amount_due / 100,
                    stripeTransactionId: event.data.object.payment_intent,
                    subscriptionId: event.data.object.subscription,
                    description: 'Subscription payment failed',
                    metadata: {
                      ...event.data.object.metadata,
                      planType: subscription.metadata.planType
                    }
                  });
                } else {
                  console.error('❌ Missing userId in subscription metadata for payment failure');
                }
              } catch (stripeError) {
                console.error('❌ Error retrieving subscription for payment failure:', stripeError);
              }
            }
            break;

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(400).send(`Webhook error: ${err.message}`);
  }
};
