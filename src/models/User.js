import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

import { ROLES } from '../utils/utilityEnums.js';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    userName: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true
    },
    passwordHash: { type: String, required: true },
    lastPassword: { type: String, default: null },
    secondLastPassword: { type: String, default: null },
    thirdLastPassword: { type: String, default: null },
    role: {
      type: String,
      enum: ROLES,
      default: 'CUSTOMER'
    },
    planType: {
      type: String,
      enum: ['10_CREDITS', 'UNLIMITED'],
      default: '10_CREDITS'
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    lockedUntil: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const hashedPassword = await bcrypt.hash(this.passwordHash, 10);
  this.passwordHash = hashedPassword;

  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
