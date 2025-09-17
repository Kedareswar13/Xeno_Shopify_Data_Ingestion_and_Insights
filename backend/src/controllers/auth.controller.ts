import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import type { User as PrismaUser } from '@prisma/client';
import { AppError, catchAsync, isAuthenticated } from '../middleware/error.middleware';
import emailService from '../services/email.service';
import logger from '../utils/logger';
import { otpLimiter, authLimiter } from '../middleware/rate-limit.middleware';

type User = PrismaUser;
const prisma = new PrismaClient();

// Generate JWT token
const signToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  
  // Use a fixed expiration time in seconds (7 days)
  const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
  
  // Create the JWT payload
  const payload = { id };
  
  // Sign the token with the secret and options
  return jwt.sign(payload, secret, { expiresIn });
};

// Create and send JWT token
const createSendToken = (
  user: User,
  statusCode: number,
  res: Response
): void => {
  const token = signToken(user.id);
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  const cookieOptions = {
    expires: new Date(
      Date.now() +
        (parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '7', 10) * 24 * 60 * 60 * 1000)
    ),
    httpOnly: true,
    secure: isProd, // only require HTTPS in production
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  };

  // Remove password from output
  (user.passwordHash as any) = undefined;
  user.otp = null;
  user.otpExpiresAt = null;

  res.status(statusCode).cookie('token', token, cookieOptions).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

// Generate OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Signup a new user
// Note: Signup verification is now handled by the OTP controller
// which updates the user's isVerified status when OTP is verified

export const signup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new AppError(
          'Validation failed',
          StatusCodes.UNPROCESSABLE_ENTITY,
          errors.array()
        )
      );
    }

    const { email, username, password, passwordConfirm } = req.body;

    // 2) Check if passwords match
    if (password !== passwordConfirm) {
      return next(
        new AppError('Passwords do not match', StatusCodes.BAD_REQUEST)
      );
    }

    // 3) Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return next(
        new AppError('Email already in use', StatusCodes.CONFLICT)
      );
    }

    // 4) Create a new tenant with a unique name by appending a random string
    const tenant = await prisma.tenant.create({
      data: {
        name: `${username}-${crypto.randomBytes(3).toString('hex')}`, // Add random string for uniqueness
      }
    });

    if (!tenant) {
      return next(
        new AppError('Failed to create tenant', StatusCodes.INTERNAL_SERVER_ERROR)
      );
    }

    // Generate OTP for signup verification
    const signupOtp = generateOTP();
    const signupOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 6) Hash the password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 7) Create new user with OTP and tenant
    const userData: any = {
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      signupOtp: await bcrypt.hash(signupOtp, 12),
      signupOtpExpires: signupOtpExpires,
      isVerified: false,
      tenantId: tenant.id,  // Use the tenant ID from the created/found tenant
    };
    
    // Only add username if it exists
    if (username) {
      userData.username = username;
    }

    let newUser;
    try {
      // 7) Create new user
      newUser = await prisma.user.create({
        data: userData,
        select: {
          id: true,
          email: true,
          username: true,
          isVerified: true,
          createdAt: true,
        },
      });

          // 8) Send OTP email using the OTP service
      try {
        const { sendOTP } = await import('./otp.controller');
        await sendOTP({
          body: { email: newUser.email },
        } as any, {
          status: (code: number) => ({
            json: (data: any) => {
              if (!data.success) {
                throw new Error(data.message || 'Failed to send OTP');
              }
              return data;
            },
          }),
          // Add any other required response methods
          json: (data: any) => data,
          send: (data: any) => data,
        } as any);
      } catch (error) {
        logger.error('Failed to send OTP email:', error);
        // Continue with registration even if email fails
      }

      // Don't log in yet, require email verification

      // 10) Remove sensitive data using type assertion
      const userResponse = { ...newUser } as Partial<User>;
      delete (userResponse as any).passwordHash;
      delete (userResponse as any).otp;

      // 11) Send response
      res.status(StatusCodes.CREATED).json({
        status: 'success',
        message: 'OTP sent to your email. Please verify your account.',
        data: {
          user: userResponse,
        },
      });
    } catch (error) {
      logger.error('Error during user registration:', error);
      
      // Only try to delete the user if it was created
      if (newUser && newUser.id) {
        try {
          await prisma.user.delete({ where: { id: newUser.id } });
        } catch (deleteError) {
          logger.error('Error cleaning up user after failed registration:', deleteError);
        }
      }
      
      // Check for duplicate email error
      if (error instanceof Error && (error.message.includes('Unique constraint failed') || error.message.includes('prisma.user.create'))) {
        return next(
          new AppError(
            'Email already in use. Please use a different email address.',
            StatusCodes.CONFLICT
          )
        );
      }
      
      return next(
        new AppError(
          'An error occurred during registration. Please try again.',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }
  }
);

// Verify OTP
export const verifyOTP = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, otp } = req.body;

    // 1) Check if OTP is provided
    if (!otp) {
      return next(
        new AppError('Please provide the OTP', StatusCodes.BAD_REQUEST)
      );
    }

    // 2) Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return next(
        new AppError('No user found with that email', StatusCodes.NOT_FOUND)
      );
    }

    // 3) Check if this is a password reset OTP verification
    const isPasswordResetOtp = !!user.resetPasswordOtp && !!user.resetPasswordOtpExpiresAt;
    
    // Skip verification status check for password reset OTPs
    if (!isPasswordResetOtp) {
      // Only check verification status for email verification OTP
      if (user.isVerified) {
        return next(
          new AppError('Email is already verified', StatusCodes.BAD_REQUEST)
        );
      }
      
      // For email verification OTP, we just need to check if user exists
      // since the OTP is verified by the OTP controller
    }

    // 4) Check if this is a password reset OTP
    if (isPasswordResetOtp) {
      if (!user.resetPasswordOtp || !user.resetPasswordOtpExpiresAt) {
        return next(
          new AppError('No password reset OTP found', StatusCodes.BAD_REQUEST)
        );
      }
      
      if (user.resetPasswordOtpExpiresAt < new Date()) {
        return next(
          new AppError('Password reset OTP has expired', StatusCodes.BAD_REQUEST)
        );
      }
      
      if (user.resetPasswordOtp !== otp) {
        return next(
          new AppError('Invalid password reset OTP', StatusCodes.UNAUTHORIZED)
        );
      }
    } else {
      // Handle email verification OTP
      // OTP is already verified by the OTP controller
      // Just update the user as verified
    }

    // 6) Update user based on OTP type
    const updateData: any = {
      failedLoginAttempts: 0, // Reset failed attempts
      lastLoginAt: new Date(),
    };

    if (isPasswordResetOtp) {
      updateData.resetPasswordOtp = null;
      updateData.resetPasswordOtpExpiresAt = null;
    } else {
      updateData.isVerified = true;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // 7) Return appropriate response based on OTP type
    if (isPasswordResetOtp) {
      res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'OTP verified. You can now reset your password.',
      });
    } else {
      // Log the user in by sending JWT for email verification
      createSendToken(updatedUser, StatusCodes.OK, res);
    }
  }
);

// Login user
export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    // Login attempt limiting disabled
    // const MAX_LOGIN_ATTEMPTS = 5;
    // const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(
        new AppError(
          'Please provide email and password',
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // 2) Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return next(
        new AppError('Incorrect email or password', StatusCodes.UNAUTHORIZED)
      );
    }

    // 3) Account lock check disabled
    /*
    if (
      user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS &&
      user.lastLoginAt &&
      new Date(user.lastLoginAt.getTime() + LOCKOUT_DURATION) > new Date()
    ) {
      const timeLeft = Math.ceil(
        (new Date(user.lastLoginAt.getTime() + LOCKOUT_DURATION).getTime() - 
         new Date().getTime()) / 60000
      );
      return next(
        new AppError(
          `Account locked. Please try again in ${timeLeft} minutes.`,
          StatusCodes.TOO_MANY_REQUESTS
        )
      );
    }
    */

    // 4) Check if password is correct
    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordCorrect) {
      // Failed login attempt - no longer tracking attempts
      /*
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          failedLoginAttempts: user.failedLoginAttempts + 1,
          lastLoginAt: new Date()
        }
      });

      const attemptsLeft = MAX_LOGIN_ATTEMPTS - (user.failedLoginAttempts + 1);
      const message = attemptsLeft > 0 
        ? `Incorrect password. ${attemptsLeft} attempt(s) left.`
        : 'Account locked. Please try again later.';
      */
      
      return next(
        new AppError('Incorrect email or password', StatusCodes.UNAUTHORIZED)
      );
    }

    // 5) Check if user is verified
    // Allow a controlled bypass only for emails listed in ALLOW_UNVERIFIED_EMAILS (comma-separated)
    const allowList = (process.env.ALLOW_UNVERIFIED_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const isBypassed = allowList.includes(email.toLowerCase());
    if (!isBypassed && !user.isVerified) {
      // No longer tracking failed attempts
      /*
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          failedLoginAttempts: 0,
          lastLoginAt: new Date()
        }
      });
      */
      
      return next(
        new AppError(
          'Please verify your email before logging in. Check your email for the verification link.', 
          StatusCodes.FORBIDDEN
        )
      );
    }

    // 6) Reset failed login attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        failedLoginAttempts: 0,
        lastLoginAt: new Date()
      }
    });

    // 7) If everything is ok, send token to client
    createSendToken(user, StatusCodes.OK, res);
  }
);

// Logout user
export const logout = (req: Request, res: Response) => {
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  res.cookie('token', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Successfully logged out',
  });
};

// Request password reset
export const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Get user based on POSTed email
    const { email } = req.body;
    const normalizedEmail = (email || '').toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't reveal that the user doesn't exist
      return res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'If an account exists with this email, a reset link has been sent',
      });
    }

    // 2) Generate the random reset token (OTP)
    const resetOTP = generateOTP();
    const resetPasswordOtpExpiresAt = new Date(
      Date.now() + 30 * 60 * 1000 // 30 minutes from now
    );

    // 3) Clear any existing OTP and set the new reset OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp: resetOTP,
        resetPasswordOtpExpiresAt,
        // Clear any existing verification OTP
        otp: null,
        otpExpiresAt: null,
      },
    });

    // Log the OTP in development for testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Password reset OTP for ${user.email}: ${resetOTP}`);
    }

    try {
      // 4) Send it to user's email using emailService
      if (emailService.isConfigured()) {
        await emailService.sendEmail({
          to: user.email,
          subject: 'Your password reset OTP (valid for 30 min)',
          template: 'password-reset',
          context: {
            name: user.username || 'there',
            otp: resetOTP,
            expiresIn: '30', // 30 minutes
          },
        });
      } else {
        logger.warn('Email service not configured. Password reset OTP not sent.');
      }

    } catch (error) {
      logger.error('Error sending password reset email:', error);
      
      // Clear the reset OTP if email sending fails
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordOtp: null,
          resetPasswordOtpExpiresAt: null,
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordOtp: null,
          resetPasswordOtpExpiresAt: null,
        },
      });

      logger.error('Error sending password reset email:', error);
      return next(
        new AppError(
          'There was an error sending the email. Please try again later.',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'OTP sent to email',
    });
  }
);

// Reset password
// Get current user
export const getCurrentUser = catchAsync(
  async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return next(new AppError('Not authenticated', StatusCodes.UNAUTHORIZED));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        user
      }
    });
  }
);

export const resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, otp, password, passwordConfirm } = req.body;

    // 1) Validate input
    if (!email || !otp || !password || !passwordConfirm) {
      return next(
        new AppError('Please provide email, OTP, and new password', StatusCodes.BAD_REQUEST)
      );
    }

    // 2) Get user based on email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return next(
        new AppError('No user found with that email', StatusCodes.NOT_FOUND)
      );
    }

    // 3) Check if OTP exists and is not expired
    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpiresAt) {
      return next(
        new AppError('No password reset OTP found or OTP has expired', StatusCodes.BAD_REQUEST)
      );
    }

    if (new Date() > user.resetPasswordOtpExpiresAt) {
      return next(
        new AppError('Password reset OTP has expired', StatusCodes.BAD_REQUEST)
      );
    }

    // 4) Verify OTP
    if (user.resetPasswordOtp !== otp) {
      return next(
        new AppError('Invalid password reset OTP', StatusCodes.UNAUTHORIZED)
      );
    }

    // 5) Check if passwords match and meet requirements
    if (password !== passwordConfirm) {
      return next(
        new AppError('Passwords do not match', StatusCodes.BAD_REQUEST)
      );
    }

    if (password.length < 8) {
      return next(
        new AppError('Password must be at least 8 characters long', StatusCodes.BAD_REQUEST)
      );
    }

    // Additional password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return next(
        new AppError(
          'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // 6) Update user's password and clear reset token
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpiresAt: null,
        updatedAt: new Date(),
      },
    });

    // 7) Get the user with updated password
    const userWithNewPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        isVerified: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!userWithNewPassword) {
      return next(new AppError('User not found after password reset', StatusCodes.INTERNAL_SERVER_ERROR));
    }

    // 6) Log the user in, send JWT
    createSendToken(userWithNewPassword as User, StatusCodes.OK, res);
  }
);

// Update password (for logged-in users)
export const updatePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthenticated(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    // 1) Get user from collection
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    }) as User | null;

    if (!user) {
      return next(
        new AppError('No user found with that ID', StatusCodes.NOT_FOUND)
      );
    }

    const { currentPassword, newPassword, passwordConfirm } = req.body;

    // 2) Check if current password is correct
    if (
      !(await bcrypt.compare(currentPassword, user.passwordHash))
    ) {
      return next(
        new AppError('Your current password is incorrect', StatusCodes.UNAUTHORIZED)
      );
    }

    // 3) Check if new passwords match
    if (newPassword !== passwordConfirm) {
      return next(
        new AppError('Passwords do not match', StatusCodes.BAD_REQUEST)
      );
    }

    // 4) Update password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
      },
    });

    // 5) Log user in, send JWT
    createSendToken(user, StatusCodes.OK, res);
  }
);
