// import Stripe from 'stripe';
// import config from '../config/index.js';

// const stripe = new Stripe(config.stripe.secretKey);

// /**
//  * Get customer payment methods by payment method ID
//  * @param {string} paymentMethodId - The Stripe payment method ID
//  * @returns {Promise<Object>} - Payment method details
//  */
// export const getCustomerPaymentMethod = async (paymentMethodId) => {
//   try {
//     // Retrieve the payment method from Stripe
//     const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
//     if (!paymentMethod) {
//       throw new Error('Payment method not found');
//     }
    
//     // Format the response data
//     return {
//       success: true,
//       paymentMethod: {
//         id: paymentMethod.id,
//         type: paymentMethod.type,
//         card: paymentMethod.card ? {
//           brand: paymentMethod.card.brand,
//           last4: paymentMethod.card.last4,
//           expMonth: paymentMethod.card.exp_month,
//           expYear: paymentMethod.card.exp_year,
//           funding: paymentMethod.card.funding
//         } : null,
//         billingDetails: paymentMethod.billing_details,
//         customerId: paymentMethod.customer
//       }
//     };
//   } catch (error) {
//     console.error('Error retrieving payment method:', error);
//     throw error;
//   }
// };

// /**
//  * List all payment methods for a customer
//  * @param {string} customerId - The Stripe customer ID
//  * @param {string} type - The payment method type (e.g., 'card')
//  * @returns {Promise<Object>} - List of payment methods
//  */
// export const listCustomerPaymentMethods = async (customerId, type = 'card') => {
//   try {
//     const paymentMethods = await stripe.paymentMethods.list({
//       customer: customerId,
//       type: type
//     });
    
//     return {
//       success: true,
//       paymentMethods: paymentMethods.data.map(pm => ({
//         id: pm.id,
//         type: pm.type,
//         card: pm.card ? {
//           brand: pm.card.brand,
//           last4: pm.card.last4,
//           expMonth: pm.card.exp_month,
//           expYear: pm.card.exp_year,
//           funding: pm.card.funding
//         } : null,
//         billingDetails: pm.billing_details
//       }))
//     };
//   } catch (error) {
//     console.error('Error listing customer payment methods:', error);
//     throw error;
//   }
// };

// export default {
//   getCustomerPaymentMethod,
//   listCustomerPaymentMethods
// };