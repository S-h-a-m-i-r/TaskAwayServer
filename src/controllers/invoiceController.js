import Transaction from '../models/transaction.js';
import { generateInvoiceHtml, generateInvoicePdf, formatInvoiceList } from '../services/invoiceService.js';
import { sendEmail } from '../services/emailService.js';
/**
 * Email invoice to user (HTML in body, PDF attached)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const emailInvoiceToUser = async (req, res) => {
  try {
    const { transactionId } = req.params;
    console.log(`[emailInvoiceToUser] Start for transactionId: ${transactionId}`);
    const transaction = await Transaction.findById(transactionId).populate('user');
    if (!transaction || !transaction.user) {
      console.warn(`[emailInvoiceToUser] Transaction or user not found for transactionId: ${transactionId}`);
      return res.status(404).json({
        success: false,
        message: 'Transaction or user not found'
      });
    }

    console.log(`[emailInvoiceToUser] Transaction and user found. User email: ${transaction.user.email}`);

    // Generate invoice HTML and PDF
    console.log(`[emailInvoiceToUser] Invoice HTML generated for transactionId: ${transactionId}`);
    const { data: invoiceData } = await generateInvoiceHtml(transactionId);
    const pdfBuffer = await generateInvoicePdf(transactionId);
    console.log(`[emailInvoiceToUser] Invoice PDF generated for transactionId: ${transactionId}`);

    // Prepare mail options
    const mailOptions = {
      attachments: [
        {
          filename: `Invoice-${transaction._id.toString().slice(-6)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    console.log(`[emailInvoiceToUser] Sending email to: ${transaction.user.email}`);
    // sendEmail signature: (to, subject, templateName, templateData, mailOptions)
    const emailResult = await sendEmail(
      transaction.user.email,
      'Your TaskAway Invoice',
      'invoice',
      { data: invoiceData },
      mailOptions
    );

    if (emailResult.error) {
      console.error(`[emailInvoiceToUser] Email sending failed: ${emailResult.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to send invoice email',
        error: emailResult.message
      });
    }

    console.log(`[emailInvoiceToUser] Invoice email sent successfully to: ${transaction.user.email}`);
    return res.json({ success: true, message: 'Invoice emailed successfully!' });
  } catch (error) {
    console.error(`[emailInvoiceToUser] Error:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to email invoice'
    });
  }
};
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
// import Transaction from '../models/transaction.js';

/**
 * Get an invoice in HTML format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getInvoiceHtml = async (req, res) => {
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
  getAllInvoices,
  emailInvoiceToUser
};