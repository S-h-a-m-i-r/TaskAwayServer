import express from 'express';
// import { body } from 'express-validator';
import {
  getAllUsers,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  searchUsers,
  getUsersByRole,
  getVerifiedUsers,
  getUsersByDateRange,
  getUserStats,
  uploadProfilePicture,
  updateProfilePicture,
  updateUser
} from '../controllers/usersController.js';
import {
  getProfilePictureDownloadUrlService,
  deleteUserProfilePictureService
} from '../services/profilePictureService.js';
import { authenticateToken } from '../middleware/auth.js';
// import {
//   updatePaymentMethod,
//   removePaymentMethod
// } from '../controllers/authController.js';
// import { auth } from '../middleware/auth.js';

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

// Profile picture routes (protected) - These must come before /:id route
router.post(
  '/profile-picture/upload-url',
  authenticateToken,
  uploadProfilePicture
);
router.put('/profile-picture', authenticateToken, updateProfilePicture);
router.get(
  '/profile-picture/download',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      const result = await getProfilePictureDownloadUrlService(userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);
router.delete('/profile-picture', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await deleteUserProfilePictureService(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Update user profile (protected) - This must come after specific routes
router.put('/:id', authenticateToken, updateUser);

// Payment method routes (protected)
// router.put('/payment-method', auth, updatePaymentMethod);
// router.delete('/payment-method', auth, removePaymentMethod);

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
