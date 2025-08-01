import express from 'express';
import { body } from 'express-validator';
import {
  getAllUsers,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  searchUsers,
  getUsersByRole,
  getVerifiedUsers,
  getUsersByDateRange,
  getUserStats
} from '../controllers/usersController.js';

const router = express.Router();

// Get all users
router.get('/', getAllUsers);

// Get users by role using query parameter
router.get('/by-role', getUsersByRole);

// Get verified users only
router.get('/verified', getVerifiedUsers);

// Get users by date range
router.get('/by-date', getUsersByDateRange);

// Search users with filters
router.get('/search', searchUsers);

// Get user statistics
router.get('/stats', getUserStats);

// Get user by ID
router.get('/:id', getUserById);

// Get user by email
router.get('/email/:email', getUserByEmail);

// Get user by username
router.get('/username/:userName', getUserByUsername);

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
