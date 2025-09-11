import stripeService from '../services/stripeService.js';
import User from '../models/User.js';
import { addCredits } from '../services/creditsService.js';
import Transaction from '../models/Transaction.js';
/**
 * Get a specific payment method for a customer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCustomerPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    
    // Validate payment method ID format
    if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method ID format'
      });
    }
    
    const paymentMethodData = await stripeService.getCustomerPaymentMethod(paymentMethodId);
    
    return res.status(200).json(paymentMethodData);
  } catch (error) {
    console.error('Error in getCustomerPaymentMethod controller:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'An error occurred while retrieving the payment method'
    });
  }
};

/**
 * List all payment methods for a customer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const listCustomerPaymentMethods = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { type = 'card' } = req.query;
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ 'paymentMethod.customerId': { $regex: new RegExp(customerId) } });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with the provided customer ID'
      });
    }    
    
    const paymentMethods = await stripeService.listCustomerPaymentMethods(customerId, type);
    
    return res.status(200).json(paymentMethods);
  } catch (error) {
    console.error('Error in listCustomerPaymentMethods controller:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'An error occurred while listing payment methods'
    });
  }
};
export const addPaymentMethod = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { paymentMethodId } = req.body;
    
    // Validate input
    if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method ID format'
      });
    }
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ 'paymentMethod.customerId': customerId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with the provided customer ID'
      });
    }
    
    // Add payment method to customer in Stripe
    const result = await stripeService.attachPaymentMethodToCustomer(
      customerId, 
      paymentMethodId
    );
    
    // Optionally set as default if requested
    if (req.body.setAsDefault) {
      await stripeService.setDefaultPaymentMethod(customerId, paymentMethodId);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Payment method added successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in addPaymentMethod controller:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'An error occurred while adding the payment method'
    });
  }
};



export const purchaseCredits = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { 
      paymentMethodId, 
      creditAmount, 
    } = req.body;
    
    // Input validation
    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'Payment method ID is required'
      });
    }
    
    if ( !creditAmount) {
      return res.status(400).json({
        success: false,
        message: ' creditAmount is required'
      });
    }
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ 'paymentMethod.customerId': customerId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with the provided customer ID'
      });
    }
    
    // Create a payment intent or use a price-based payment
    let paymentResult;
      const eachCreditPrice = 5
      const amount = creditAmount/100;
      const totalCredits  = amount/eachCreditPrice;

      
      paymentResult = await stripeService.createOneTimePayment(
        customerId,
        paymentMethodId,
        amount,
        `Purchase of ${totalCredits} credits`,
        {
          userId: user._id.toString(), 
        }
      );
      // Add credits to user's account
      if (paymentResult.success) {
        await addCredits(
          user._id, 
          totalCredits, 
          `Credit Purchase (${creditAmount} credits)`
        );

        await recordTransaction({
            user: user._id,
            amount, // Convert cents to dollars
            currency: 'usd',
            description: `Purchased ${totalCredits} credits`,
            status: 'completed',
            transactionType: 'credit_purchase',
            stripeTransactionId: paymentResult.paymentId,
            metadata: {}
          });
      }
    // }
    
    return res.status(200).json({
      success: true,
      message: 'Credits purchased successfully',
      data: {
        paymentId: paymentResult.paymentId,
        amount: paymentResult.amount/100,
        credits: creditAmount/100 || paymentResult.metadata?.creditAmount/100,
        status: paymentResult.status
      }
    });
  } catch (error) {
    console.error('Error in purchaseCredits controller:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'An error occurred while processing payment'
    });
  }
};


export const recordTransaction = async (transactionData) => {
  try {
    const transaction = await Transaction.create(transactionData);
    console.log(`✅ Transaction recorded: ${transaction._id}`);
    return transaction;
  } catch (error) {
    console.error('❌ Error recording transaction:', error);
    throw error;
  }
};

export default {
  getCustomerPaymentMethod,
  listCustomerPaymentMethods,
  addPaymentMethod,
  purchaseCredits
};