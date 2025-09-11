import express from 'express';
import invoiceController from '../controllers/invoiceController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/invoices/:transactionId/html
 * @desc Get invoice in HTML format
 * @access Private
 */
router.get('/:transactionId/html', authenticateToken, invoiceController.getInvoiceHtml);

/**
 * @route GET /api/invoices/:transactionId/pdf
 * @desc Get invoice in PDF format
 * @access Private
 */
router.get('/:transactionId/pdf', authenticateToken, invoiceController.getInvoicePdf);

export default router;