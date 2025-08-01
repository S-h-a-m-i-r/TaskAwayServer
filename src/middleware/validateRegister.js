import { body, validationResult } from 'express-validator';
import { createError } from '../utils/AppError.js';

export const validateRegister = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),

  body('lastName').trim().notEmpty().withMessage('Last name is required'),

  body('userName')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isAlphanumeric()
    .withMessage('Username must be alphanumeric'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .withMessage('Email must be valid'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(\+1\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}$/)
    .withMessage('Phone number must be a valid US format'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }));

      return next(
        createError.validation('Validation failed', {
          errors: formattedErrors
        })
      );
    }
    next();
  }
];
