import express from 'express';
// import stripeController from '../controllers/stripeController.js';
// import { authenticate } from '../middleware/auth.js';

const router = express.Router();

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

export default router;