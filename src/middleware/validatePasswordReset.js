import { body, query, validationResult } from 'express-validator';
import { createError } from '../utils/AppError.js';

export const validatePasswordReset = [
  // Validate token from query parameters
  query('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isString()
    .withMessage('Reset token must be a string'),

  // Validate new password from body
  body('password')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long'),

  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }));

      return next(
        createError.validation('Password reset validation failed', {
          errors: formattedErrors
        })
      );
    }
    next();
  }
];
