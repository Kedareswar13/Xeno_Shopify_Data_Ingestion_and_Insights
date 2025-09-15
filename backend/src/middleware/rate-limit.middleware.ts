import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { AppError } from './error.middleware';

// Rate limiting for OTP requests (5 requests per hour)
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // 5 requests per window
  message: 'Too many OTP requests from this IP, please try again after an hour',
  handler: (req, res, next, options) => {
    throw new AppError(options.message, StatusCodes.TOO_MANY_REQUESTS);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general API routes (100 requests per 15 minutes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  handler: (req, res, next, options) => {
    throw new AppError(options.message, StatusCodes.TOO_MANY_REQUESTS);
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate limiting for authentication routes (10 requests per hour)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after an hour',
  handler: (req, res, next, options) => {
    throw new AppError(options.message, StatusCodes.TOO_MANY_REQUESTS);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for public endpoints (1000 requests per 15 minutes)
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  handler: (req, res, next, options) => {
    throw new AppError(options.message, StatusCodes.TOO_MANY_REQUESTS);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export rateLimiter as an alias for apiLimiter for backward compatibility
export const rateLimiter = apiLimiter;
