import Transaction from '../models/Transaction.js';
import { generateInvoiceHtml, generateInvoicePdf, formatInvoiceList } from '../services/invoiceService.js';
/**
 * Get all transactions as invoices
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllInvoices = async (req, res) => {
  try {
    // Get all transactions, populate user
    const transactions = await Transaction.find({}).populate('user');
    const invoices = formatInvoiceList(transactions);
    return res.json({ success: true, invoices });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
// import Transaction from '../models/Transaction.js';

/**
 * Get an invoice in HTML format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getInvoiceHtml = async (req, res) => {
  try {
    const { transactionId, userId } = req.params;
    
    // Check if transaction belongs to the authenticated user
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    // Check if the user owns this transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not own this transaction'
      });
    }
    
    // Generate invoice HTML
    const { html } = await generateInvoiceHtml(transactionId);
    
    // Set content type and send HTML
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (error) {
    console.error('Error in getInvoiceHtml controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate invoice'
    });
  }
};

/**
 * Get an invoice in PDF format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getInvoicePdf = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    // Check if transaction belongs to the authenticated user
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    // Generate invoice number for filename
    const invoiceNumber = `INV-${transaction._id.toString().slice(-6)}`;
    
    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(transactionId);
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoiceNumber}.pdf"`);
    
    // Send PDF
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error in getInvoicePdf controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate invoice PDF'
    });
  }
};

export default {
  getInvoiceHtml,
  getInvoicePdf,
  getAllInvoices
};