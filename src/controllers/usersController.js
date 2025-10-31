import User from '../models/User.js';
import {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  generateProfilePictureS3Key,
  isValidProfilePictureType,
  isValidFileSize,
  deleteFileFromS3,
  getS3Url
} from '../config/s3.js';
import {
  generateProfilePictureUploadUrlService,
  updateUserProfilePictureService,
  getProfilePictureDownloadUrlService,
  deleteUserProfilePictureService
} from '../services/profilePictureService.js';
import bcrypt from 'bcrypt';

// Get all users with pagination
export const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find({})
      .select(
        '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
      )
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const totalUsers = await User.countDocuments({});

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select(
      '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Get user by email
export const getUserByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Get user by username
export const getUserByUsername = async (req, res, next) => {
  try {
    const { userName } = req.params;
    const user = await User.findOne({
      userName: userName.toLowerCase()
    }).select(
      '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Search users
export const searchUsers = async (req, res, next) => {
  try {
    const { q, role, planType, isEmailVerified } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};

    // Search by name or username
    if (q) {
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { userName: { $regex: q, $options: 'i' } }
      ];
    }

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by plan type
    if (planType) {
      query.planType = planType;
    }

    // Filter by email verification status
    if (isEmailVerified !== undefined) {
      query.isEmailVerified = isEmailVerified === 'true';
    }

    const users = await User.find(query)
      .select(
        '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
      )
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get users by role using query parameter
export const getUsersByRole = async (req, res, next) => {
  try {
    const { role } = req.query; // Changed from req.params to req.query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate role parameter
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role parameter is required'
      });
    }

    // Split roles by comma and convert to uppercase
    const roles = role.split(',').map((r) => r.trim().toUpperCase());

    // Validate role values
    const validRoles = ['CUSTOMER', 'BASIC', 'MANAGER', 'ADMIN'];
    const invalidRoles = roles.filter((r) => !validRoles.includes(r));

    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid role(s): ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}`
      });
    }

    // Build query for multiple roles
    const roleQuery =
      roles.length === 1 ? { role: roles[0] } : { role: { $in: roles } };

    const users = await User.find(roleQuery)
      .select(
        '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
      )
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(roleQuery);

    res.status(200).json({
      success: true,
      users: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get verified users only
export const getVerifiedUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find({ isEmailVerified: true })
      .select(
        '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
      )
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments({ isEmailVerified: true });

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get users created in date range
export const getUsersByDateRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let dateQuery = {};

    if (startDate && endDate) {
      dateQuery = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else if (startDate) {
      dateQuery = {
        createdAt: {
          $gte: new Date(startDate)
        }
      };
    } else if (endDate) {
      dateQuery = {
        createdAt: {
          $lte: new Date(endDate)
        }
      };
    }

    const users = await User.find(dateQuery)
      .select(
        '-passwordHash -lastPassword -secondLastPassword -thirdLastPassword'
      )
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(dateQuery);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user statistics
export const getUserStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({});
    const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
    const unverifiedUsers = await User.countDocuments({
      isEmailVerified: false
    });

    // Count by role
    const customers = await User.countDocuments({ role: 'CUSTOMER' });
    const admins = await User.countDocuments({ role: 'ADMIN' });

    // Count by plan type
    const creditUsers = await User.countDocuments({ planType: '10_CREDITS' });
    const unlimitedUsers = await User.countDocuments({ planType: 'UNLIMITED' });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        verificationRate:
          totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0,
        byRole: {
          customers,
          admins
        },
        byPlan: {
          creditUsers,
          unlimitedUsers
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Generate presigned URL for profile picture upload
export const uploadProfilePicture = async (req, res, next) => {
  try {
    const { filename, contentType, fileSize } = req.body;
    const userId = req.user._id;

    const result = await generateProfilePictureUploadUrlService(
      filename,
      contentType,
      fileSize,
      userId
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Update user profile picture URL in database
export const updateProfilePicture = async (req, res, next) => {
  try {
    const { s3Key } = req.body;
    const userId = req.user._id;

    if (!s3Key) {
      return res.status(400).json({
        success: false,
        message: 'S3 key is required'
      });
    }

    const result = await updateUserProfilePictureService(userId, s3Key);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

async function handlePasswordUpdate(req, user, bcrypt) {
  const { password, currentPassword } = req.body;
  const updateData = {};

  // If password is not being updated, return success
  if (!password && !currentPassword) {
    return {
      code: 200,
      success: true,
      message: 'No password update requested.'
    };
  }

  // If password is being updated, current password is required
  if (!currentPassword) {
    return {
      code: 400,
      success: false,
      message: 'Current password is required to authorize this change.'
    };
  }

  // Verify the provided current password against the one in the database.
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isMatch) {
    return {
      code: 400,
      success: false,
      message: 'Current Password is incorrect. Not authorized.'
    };
  }
  if (!password) {
    return {
      code: 400,
      success: false,
      message: 'New password is required.'
    };
  }

  if (currentPassword === password) {
    return {
      code: 400,
      success: false,
      message: 'New password cannot be the same as your current password.'
    };
  }
  const [isSameAsSecondLast, isSameAsThirdLast] = await Promise.all([
    user.secondLastPassword
      ? bcrypt.compare(password, user.secondLastPassword)
      : false,
    user.thirdLastPassword
      ? bcrypt.compare(password, user.thirdLastPassword)
      : false
  ]);

  if (isSameAsSecondLast || isSameAsThirdLast) {
    return {
      code: 400,
      success: false,
      message:
        'New password cannot be the same as one of your recent passwords.'
    };
  }
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(password, saltRounds);
  updateData.passwordHash = newPasswordHash;
  updateData.secondLastPassword = user.passwordHash; // The (now old) current password
  updateData.thirdLastPassword = user.secondLastPassword; // The (now older) 2nd last
  return {
    code: 200,
    success: true,
    message: 'Password validation successful. Ready to update.',
    ...updateData
  };
}
// Update user profile information
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, userName, email, profilePicture } = req.body;

    // Validate required fields
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being updated and if it's already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }
    }

    // Check if username is being updated and if it's already taken by another user
    if (userName && userName !== user.userName) {
      const existingUser = await User.findOne({ userName, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken by another user'
        });
      }
    }
    // Update user fields
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (userName !== undefined) updateData.userName = userName;
    if (email !== undefined) updateData.email = email;
    if (profilePicture !== undefined)
      updateData.profilePicture = profilePicture;

    // Handle password update if password fields are provided
    const result = await handlePasswordUpdate(req, user, bcrypt);
    if (result.code !== 200) {
      return res.status(result.code).json({
        success: result.success,
        message: result.message
      });
    } else if (result.passwordHash) {
      // Only update password fields if password was actually being changed
      updateData.passwordHash = result.passwordHash;
      updateData.secondLastPassword = result.secondLastPassword;
      updateData.thirdLastPassword = result.thirdLastPassword;
    }
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    // Remove sensitive information
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpires;

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: userResponse
    });
  } catch (error) {
    console.error('Update user error:', error);
    next(error);
  }
};
