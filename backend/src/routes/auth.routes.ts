import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { catchAsync } from '../middleware/error.middleware';
import { protect } from '../middleware/auth.middleware';
import { otpLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// Input validation rules
const signupValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
  body('passwordConfirm')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const verifyOtpValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
];

const resetPasswordValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('passwordConfirm')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

const updatePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long'),
  body('passwordConfirm')
    .notEmpty()
    .withMessage('Please confirm your new password'),
];

// Public routes
router.post('/signup', signupValidation, catchAsync(authController.signup));
router.post('/login', loginValidation, catchAsync(authController.login));
router.post('/verify-otp', otpLimiter, verifyOtpValidation, catchAsync(authController.verifyOTP));
// Forgot/reset password should be public (no token yet)
router.post(
  '/forgot-password',
  otpLimiter,
  forgotPasswordValidation,
  catchAsync(authController.forgotPassword)
);
router.post(
  '/reset-password',
  resetPasswordValidation,
  catchAsync(authController.resetPassword)
);

// Protected routes
router.use(protect);
router.get('/me', catchAsync(authController.getCurrentUser));
router.get('/logout', catchAsync(authController.logout));
router.patch(
  '/update-password',
  updatePasswordValidation,
  catchAsync(authController.updatePassword)
);

export default router;
