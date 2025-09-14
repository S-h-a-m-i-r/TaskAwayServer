import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { getTemplate } from '../utils/handlebars.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate invoice data from a transaction
 * @param {Object} transaction - Transaction document
 * @param {Object} user - User document
 * @returns {Object} - Invoice data
 */
const generateInvoiceData = (transaction, user) => {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + 14); // Due in 14 days
  
  // Format dates
  const formatDate = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  // Generate invoice number using transaction ID and date
  const invoiceNumber = `INV-${today.getFullYear()}-${transaction._id.toString().slice(-6)}`;
  
  // Create invoice item
  let description = 'Credit Purchase';
  let quantity = 1;
  let unitPrice = transaction.amount;
  let amount = transaction.amount;
  
  // If credit amount is in metadata, use it to calculate unit price
  if (transaction.metadata && transaction.metadata.creditAmount) {
    description = `Purchase of ${transaction.metadata.creditAmount} TaskAway Credits`;
    quantity = Number(transaction.metadata.creditAmount);
    unitPrice = transaction.amount / quantity;
    amount = transaction.amount;
  }
  
  return {
    invoiceNumber,
    reference: transaction._id.toString(),
    issueDate: formatDate(transaction.createdAt || today),
    dueDate: formatDate(dueDate),
    
    businessName: "TaskAway Solutions",
    businessAddress: [
      "789 Developer Lane",
      "Tech Park Phase 3",
      "San Francisco, CA 94107",
    ],
    businessPhone: "+1 (415) 123-4567",
    businessEmail: "billing@taskaway.com",
    businessWebsite: "www.taskaway.com",
    
    clientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
    clientAddress: [
      user.address || "Client Address",
      user.city || "Client City",
      user.country || "Client Country",
    ],
    
    items: [
      {
        id: "1",
        description,
        quantity,
        unitPrice,
        amount,
      }
    ],
    
    subtotal: transaction.amount,
    total: transaction.amount,
    currency: transaction.currency || "USD",
  };
};

/**
 * Generate an invoice HTML for a transaction
 * @param {string} transactionId - Transaction ID
 * @param {string} userId - Optional user ID (if not available in transaction)
 * @returns {Promise<Object>} - Invoice HTML and data
 */
export const generateInvoiceHtml = async (transactionId) => {
  try {
    // Find the transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    // Find the user (either from transaction or provided userId)
    const userIdToFind = transaction.user;
    const user = await User.findById(userIdToFind);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate invoice data
    const invoiceData = generateInvoiceData(transaction, user);
    
    // Get the template - note the filename with no double periods
    const template = getTemplate('invoice');
    
    // Render the template with data
    const html = template({ data: invoiceData });
    
    return {
      html,
      data: invoiceData
    };
  } catch (error) {
    console.error('Error generating invoice HTML:', error);
    throw error;
  }
};

/**
 * Generate an invoice PDF for a transaction
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateInvoicePdf = async (transactionId) => {
  let browser = null;
  try {
    // Generate invoice HTML
    const { html } = await generateInvoiceHtml(transactionId);
    
    // Create PDF with puppeteer
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      printBackground: true
    });
    
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Format a list of transactions as invoice objects for API response
 * @param {Array} transactions - Array of transaction documents (populated with user)
 * @returns {Array} - Array of invoice objects
 */
export const formatInvoiceList = (transactions) => {
  return transactions.map(tx => ({
    invoiceNumber: tx._id,
    user: tx.user ? `${tx.user.firstName} ${tx.user.lastName}` : 'Unknown',
    invoiceAmount: tx.amount,
    invoiceDate: tx.createdAt,
    invoicePaymentmethod: tx.user && tx.user.paymentMethod && tx.user.paymentMethod.cardBrand ? `${tx.user.paymentMethod.cardBrand} ****${tx.user.paymentMethod.cardLast4}` : 'N/A',
    invoicePaymentType: tx.transactionType === 'subscription' ? 'subscription' : 'credit payment',
  }));
};

export default {
  generateInvoiceHtml,
  generateInvoicePdf,
  formatInvoiceList
};