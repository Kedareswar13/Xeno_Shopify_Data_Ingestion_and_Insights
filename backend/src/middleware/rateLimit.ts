import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import AppError from '../utils/appError';

// Rate limiting for OTP requests
const otpRateLimiter = new RateLimiterMemory({
  points: 5, // 5 requests
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes if limit is exceeded
});

export const otpLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  otpRateLimiter.consume(clientIP)
    .then(() => {
      next();
    })
    .catch(() => {
      next(
        new AppError(
          'Too many OTP requests. Please try again after 15 minutes.',
          429 // Too Many Requests
        )
      );
    });
};

// Rate limiting for login attempts
const loginRateLimiter = new RateLimiterMemory({
  points: 10, // 10 login attempts
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes if limit is exceeded
});

export const loginLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  loginRateLimiter.consume(clientIP)
    .then(() => {
      next();
    })
    .catch(() => {
      next(
        new AppError(
          'Too many login attempts. Please try again after 15 minutes.',
          429 // Too Many Requests
        )
      );
    });
};
