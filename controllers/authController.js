import { validationResult } from 'express-validator';
// import * as authService from '../services/authService.js';

export const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
