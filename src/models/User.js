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
      trim: true
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
    passwordResetToken: {
      type: String,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    },
    lockedUntil: {
      type: Date,
      default: null
    },
    paymentMethod: {
      paymentMethodId: {
        type: String,
        default: null
      },
      customerId: {
        type: String,
        default: null
      },
      cardLast4: {
        type: String,
        default: null
      },
      cardBrand: {
        type: String,
        default: null
      },
      cardExpMonth: {
        type: Number,
        default: null
      },
      cardExpYear: {
        type: Number,
        default: null
      },
      cardFunding: {
        type: String,
        default: null
      },
      token: {
        type: String,
        default: null
      },
      
    },
    activeSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', null],
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Remove the pre-save hook that causes double hashing
// userSchema.pre('save', async function (next) {
//   if (!this.isModified('passwordHash')) return next();
//   const hashedPassword = await bcrypt.hash(this.passwordHash, 10);
//   this.passwordHash = hashedPassword;
//   next();
// });

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to update payment method
userSchema.methods.updatePaymentMethod = function (paymentMethodData) {
  this.paymentMethod = {
    paymentMethodId: paymentMethodData.paymentMethodId || null,
    customerId: paymentMethodData.customerId || null,
    cardLast4: paymentMethodData.cardLast4 || null,
    cardBrand: paymentMethodData.cardBrand || null,
    cardExpMonth: paymentMethodData.cardExpMonth || null,
    cardExpYear: paymentMethodData.cardExpYear || null,
    cardFunding: paymentMethodData.cardFunding || null,
    token: paymentMethodData.token || null
  };
  return this.save();
};

// Method to remove payment method
userSchema.methods.removePaymentMethod = function () {
  this.paymentMethod = {
    paymentMethodId: null,
    customerId: null,
    cardLast4: null,
    cardBrand: null,
    cardExpMonth: null,
    cardExpYear: null,
    cardFunding: null,
    token: null
  };
  return this.save();
};

const User = mongoose.model('User', userSchema);
export default User;
