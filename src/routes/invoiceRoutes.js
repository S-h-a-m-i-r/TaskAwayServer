import express from 'express';
import invoiceController from '../controllers/invoiceController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/invoices/:transactionId/html
 * @desc Get invoice in HTML format
 * @access Private
 */
router.get('/:transactionId/html', authenticateToken, invoiceController.emailInvoiceToUser);

/**
 * @route GET /api/invoices/:transactionId/pdf
 * @desc Get invoice in PDF format
 * @access Private
 */
router.get('/:transactionId/pdf', authenticateToken, invoiceController.getInvoicePdf);

/**
 * @route GET /api/invoices/all
 * @desc Get all transactions as invoices
 * @access Private (admin only)
 */
router.get('/all', authenticateToken,
  authorizeRoles('ADMIN'), invoiceController.getAllInvoices);


export default router;