import express from 'express';
// import stripeController from '../controllers/stripeController.js';
import { authenticateToken } from '../middleware/auth.js';
import Stripe from 'stripe';
import { stripeWebhookHandler } from '../webhooks/stripeWebhook.js';
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
/**
 * @route GET /stripe/customers/:paymentMethodId/payment-methods
 * @desc Get a specific payment method by ID
 * @access Private
 */
// router.get(
//   'stripe/customers/:paymentMethodId/payment-methods',
//   authenticate,
//   stripeController.getCustomerPaymentMethod
// );

/**
 * @route GET /stripe/customers/:customerId/payment-methods/list
 * @desc List all payment methods for a customer
 * @access Private
 */
// router.get(
//   '/customers/:customerId/payment-methods',
//   authenticate,
//   stripeController.listCustomerPaymentMethods
// );



router.post('/create/customer', async (req, res) => {
    try {
      const { email, name, paymentMethodId } = req.body;
      
      // Create a customer in Stripe
      const customer = await stripe.customers.create({
        email,
        name,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      res.json({
        success: true,
        customerId: customer.id,
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create customer',
      });
    }
  });


  router.post('/customer/:customerId/payment-methods',authenticateToken, async (req, res) => {
    try {
      const { customerId } = req.params;
      const { paymentMethodId } = req.body;
      
      // Attach the payment method to the customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      // Get the payment method details
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      // Check if this is the first payment method (make it default if so)
      const existingMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      
      const isDefault = existingMethods.data.length === 1;
      
      // If this is the only payment method, set it as default
      if (isDefault) {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }
      
      res.json({
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          card: {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
          },
        },
        isDefault,
      });
    } catch (error) {
      console.error('Error attaching payment method:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to attach payment method',
      });
    }
  });

  router.post('/stripeWebhook', stripeWebhookHandler )

export default router;