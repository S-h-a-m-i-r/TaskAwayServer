// import stripeService from '../services/stripeService.js';
import User from '../models/User.js';

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
    const { type } = req.query;
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ 'paymentMethod.paymentMethodId': { $regex: new RegExp(customerId) } });
    
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

export default {
  getCustomerPaymentMethod,
  listCustomerPaymentMethods
};