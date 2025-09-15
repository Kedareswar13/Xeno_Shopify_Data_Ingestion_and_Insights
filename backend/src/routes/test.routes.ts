import { Router } from 'express';
import { testEmail } from '../controllers/test.controller';
import { rateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

/**
 * @route   POST /api/test/email
 * @desc    Test email sending functionality
 * @access  Public
 */
router.post('/email', rateLimiter, testEmail);

export default router;
