import { Router } from 'express';
import { sendOTP, verifyOTP } from '../controllers/otp.controller';
import { rateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

/**
 * @route   POST /api/otp/send
 * @desc    Send OTP to user's email
 * @access  Public
 */
router.post('/send', rateLimiter, sendOTP);

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP and login user
 * @access  Public
 */
router.post('/verify', rateLimiter, verifyOTP);

export default router;
