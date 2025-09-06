import Stripe from 'stripe';
import config from '../config/index.js';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

/**
 * Get customer payment method details by ID
 * @param {string} paymentMethodId - Stripe PaymentMethod ID
 * @returns {Promise<Object>} - Normalized payment method response
 */
export const getCustomerPaymentMethod = async (paymentMethodId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (!paymentMethod) {
      return { success: false, error: 'Payment method not found' };
    }

    return {
      success: true,
      data: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card
          ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
              funding: paymentMethod.card.funding,
            }
          : null,
        billingDetails: paymentMethod.billing_details,
        customerId: paymentMethod.customer,
      },
    };
  } catch (error) {
    console.error('❌ Error retrieving payment method:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * List all payment methods for a customer
 * @param {string} customerId - Stripe customer ID
 * @param {string} type - Payment method type (default: 'card')
 * @returns {Promise<Object>} - Normalized list of payment methods
 */
export const listCustomerPaymentMethods = async (customerId, type = 'card') => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type,
    });

    return {
      success: true,
      data: paymentMethods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              funding: pm.card.funding,
            }
          : null,
        billingDetails: pm.billing_details,
      })),
    };
  } catch (error) {
    console.error('❌ Error listing customer payment methods:', error.message);
    return { success: false, error: error.message };
  }
};

export default {
  getCustomerPaymentMethod,
  listCustomerPaymentMethods,
};
