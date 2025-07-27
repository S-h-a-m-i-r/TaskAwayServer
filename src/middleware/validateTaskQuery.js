import { query } from 'express-validator';

export const validateTaskQuery = [
  query('status')
    .optional()
    .isIn(['Submitted', 'InProgress', 'Completed', 'Closed', 'Pending'])
    .withMessage('Invalid status'),
  query('title')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Title must be at least 1 character'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'title', 'status'])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Invalid sort order')
];