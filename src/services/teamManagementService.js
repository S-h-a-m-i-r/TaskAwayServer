import User from '../models/User.js';
import { createError } from '../utils/AppError.js';
import bcrypt from 'bcryptjs';

export const addTeamMemberService = async (data) => {
    try {
        const { firstName, lastName, userName, email, phone, role, password, isVerified } = data;
        if (!firstName || !lastName || !email || !password) {
            throw createError.validation('Missing required fields: firstName, lastName, email, and password are required');
        }

        // Validate role if provided
        if (role && !['BASIC', 'MANAGER'].includes(role)) {
            throw createError.validation('Role must be either BASIC or MANAGER');
        }
        const existingUsers = await User.find({ email: email.toLowerCase() });
        if (existingUsers.length > 0) {
            throw createError.conflict('User with this email already exists');
        }
        if (userName) {
            const existingUsernames = await User.find({ userName: userName.toLowerCase() });
            if (existingUsernames.length > 2) {
                throw createError.conflict('Username is already taken');
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({ 
            firstName, 
            lastName, 
            userName: userName.toLowerCase(), 
            email: email.toLowerCase(), 
            phone, 
            role: role.toUpperCase(), 
            passwordHash: hashedPassword, 
            isEmailVerified: isVerified || false 
        });

        const userResponse = user.toObject();
        delete userResponse.password;

        return userResponse;

    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            throw createError.validation('Validation failed', validationErrors);
        }
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            throw createError.conflict(`${field} already exists`);
        }
        if (error.isOperational) {
            throw error;
        }
        console.error('Team member creation error:', error);
        throw createError.internal('Failed to create team member');
    }
}

export const getTeamMemberByIdService = async (id) => {
    try {
        const user = await User.findById(id).select('-passwordHash -paymentMethod -lastPassword -secondLastPassword -thirdLastPassword -isEmailVerified -passwordResetToken -passwordResetExpires -lockedUntil -createdAt -updatedAt -planType');
        if (!user) {
            throw createError.notFound('User not found');
        }
        const userResponse = user.toObject();
        return userResponse;
    }
    catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Team member get by id error:', error);
        throw createError.internal('Failed to get team member by id');
    }
}

export const updateTeamMemberService = async (data, id) => {
    try {
        const { firstName, lastName, userName, email, phone, role, password, isVerified } = data;

        // First, find the user by ID
        const existingUser = await User.findById(id);
        if (!existingUser) {
            throw createError.notFound('User not found');
        }

        // Check if email is being changed and if it conflicts with other users
        if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
            const emailConflict = await User.findOne({ 
                email: email.toLowerCase(),
                _id: { $ne: id } // Exclude current user from check
            });
            if (emailConflict) {
                throw createError.conflict('User with this email already exists');
            }
        }

        // Check if username is being changed and if it conflicts with other users
        if (userName && userName.toLowerCase() !== existingUser.userName?.toLowerCase()) {
            const usernameConflict = await User.find({ 
                userName: userName.toLowerCase(),
                _id: { $ne: id } // Exclude current user from check
            });
            if (usernameConflict.length > 2) {
                throw createError.conflict('Username is already taken');
            }
        }

        // Validate role if provided
        if (role && !['BASIC', 'MANAGER'].includes(role)) {
            throw createError.validation('Role must be either BASIC or MANAGER');
        }

        // Prepare update data (only include fields that are provided)
        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (userName) updateData.userName = userName;
        if (email) updateData.email = email.toLowerCase();
        if (phone) updateData.phone = phone;
        if (role) updateData.role = role;
        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }
        if (isVerified !== undefined) updateData.isEmailVerified = isVerified;
        // Update the user
        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        const userResponse = updatedUser.toObject();
        delete userResponse.password;

        return userResponse;

    } catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            throw createError.validation('Validation failed', validationErrors);
        }
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            throw createError.conflict(`${field} already exists`);
        }
        if (error.isOperational) {
            throw error;
        }
        console.error('Team member update error:', error);
        throw createError.internal('Failed to update team member');
    }
}

export const deleteTeamMemberService = async (id) => {
    try {
        // First, find the user by ID
        const existingUser = await User.findById(id);
        if (!existingUser) {
            throw createError.notFound('User not found');
        }

        // Delete the user
        const deletedUser = await User.findByIdAndDelete(id);
        
        if (!deletedUser) {
            throw createError.internal('Failed to delete user');
        }

        const userResponse = deletedUser.toObject();
        delete userResponse.password;

        return {
            message: 'Team member deleted successfully',
            deletedUser: userResponse
        };

    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Team member deletion error:', error);
        throw createError.internal('Failed to delete team member');
    }
}

export const getAllTeamMembersService = async () => {
    try {
        // Get only users with BASIC or MANAGER roles
        const teamMembers = await User.find({
            role: { $in: ['BASIC', 'MANAGER'] }
        }).select('-passwordHash -paymentMethod -lastPassword -secondLastPassword -thirdLastPassword -isEmailVerified -passwordResetToken -passwordResetExpires -lockedUntil -createdAt -updatedAt -planType');

        return {
            count: teamMembers.length,
            teamMembers
        };

    } catch (error) {
        console.error('Get team members error:', error);
        throw createError.internal('Failed to get team members');
    }
}
