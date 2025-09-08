import express from 'express';
import stripeController from '../controllers/stripeController.js';
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


  router.get('/customer/:customerId/payment-methods',authenticateToken,  stripeController.listCustomerPaymentMethods);
  router.post('/customer/:customerId/payment-methods', 
    authenticateToken, 
    stripeController.addPaymentMethod
  );

  router.post('/customer/:customerId/addCard', authenticateToken, stripeController.addPaymentMethod);
  router.post('/:customerId/purchaseCredits', authenticateToken, stripeController.purchaseCredits);

  router.post('/stripeWebhook', stripeWebhookHandler )

export default router;