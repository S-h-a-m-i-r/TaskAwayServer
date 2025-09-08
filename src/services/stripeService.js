import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
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

export const attachPaymentMethodToCustomer = async (customerId, paymentMethodId) => {
  try {
    // First attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Then retrieve the updated payment method
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year
    };
  } catch (error) {
    console.error('Error attaching payment method to customer:', error);
    throw error;
  }
};


export const createOneTimePayment = async (
  customerId, 
  paymentMethodId, 
  amount, 
  description, 
  metadata = {}
) => {
  try {
    // Validate inputs
    if (!customerId) throw new Error('Customer ID is required');
    if (!paymentMethodId) throw new Error('Payment Method ID is required');
    if (!amount || amount <= 0) throw new Error('Valid amount is required');

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // Amount in cents
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      description: description || 'One-time payment',
      confirm: true, // Confirm the payment intent immediately
      off_session: true, // Customer not present (background payment)
      metadata: {
        ...metadata,
        payment_type: 'one_time'
      }
    });

    // Return successful payment details
    return {
      success: true,
      paymentId: paymentIntent.id,
      amount: paymentIntent.amount / 100, // Convert cents to dollars
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret,
      receiptUrl: paymentIntent.charges?.data[0]?.receipt_url || null,
      metadata: paymentIntent.metadata
    };
  } catch (error) {
    // Handle authentication required error
    if (error.code === 'authentication_required') {
      return {
        success: false,
        status: 'requires_action',
        clientSecret: error.payment_intent.client_secret,
        error: 'This payment requires additional authentication',
        paymentId: error.payment_intent.id
      };
    }
    
    // Handle card errors
    if (error.type === 'StripeCardError') {
      return {
        success: false,
        status: 'failed',
        error: error.message || 'Card was declined',
        code: error.code
      };
    }

    // Log and handle other errors
    console.error('❌ Error creating one-time payment:', error);
    return {
      success: false,
      status: 'error',
      error: error.message || 'An error occurred while processing payment'
    };
  }
};

/**
 * Create a credit purchase using a specific price
 * @param {string} customerId - Stripe Customer ID
 * @param {string} paymentMethodId - Stripe PaymentMethod ID
 * @param {string} priceId - Stripe Price ID for credit package
 * @param {Object} metadata - Additional metadata for the purchase
 * @returns {Promise<Object>} - Payment result
 */
export const createCreditPurchase = async (
  customerId, 
  paymentMethodId, 
  priceId,
  metadata = {}
) => {
  try {
    // Validate inputs
    if (!customerId) throw new Error('Customer ID is required');
    if (!paymentMethodId) throw new Error('Payment Method ID is required');
    if (!priceId) throw new Error('Price ID is required');

    // Create an invoice item for the customer
    const invoiceItem = await stripe.invoiceItems.create({
      customer: customerId,
      price: priceId,
      metadata: {
        ...metadata,
        type: 'credit_purchase'
      }
    });
    
    // Create an invoice and pay it immediately
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true, // Auto-finalize the invoice
      collection_method: 'charge_automatically',
      default_payment_method: paymentMethodId
    });
    
    // Pay the invoice immediately
    const paidInvoice = await stripe.invoices.pay(invoice.id);
    
    return {
      success: true,
      paymentId: paidInvoice.payment_intent,
      invoiceId: paidInvoice.id,
      amount: paidInvoice.amount_paid / 100, // Convert cents to dollars
      status: paidInvoice.status,
      receiptUrl: paidInvoice.hosted_invoice_url,
      priceId: priceId
    };
  } catch (error) {
    console.error('❌ Error creating credit purchase:', error);
    return {
      success: false,
      status: 'error',
      error: error.message || 'An error occurred while processing the purchase'
    };
  }
};

export default {
  getCustomerPaymentMethod,
  listCustomerPaymentMethods,
  attachPaymentMethodToCustomer,
  createOneTimePayment,
  createCreditPurchase
};