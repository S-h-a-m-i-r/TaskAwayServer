import express from 'express';
import { body } from 'express-validator';

const router = express.Router();

// router.post(
//   '/addUser',
// //   [body('email').isEmail(), body('password').isLength({ min: 6 })],
// //   register
// );

// router.post(
//   '/removeUser',
// //   [body('email').isEmail(), body('password').exists()],
// //   login
// );

export default router;
