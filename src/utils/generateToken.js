import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '10d' });
};

export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};
