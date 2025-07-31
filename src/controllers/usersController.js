import User from '../models/User.js';

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
