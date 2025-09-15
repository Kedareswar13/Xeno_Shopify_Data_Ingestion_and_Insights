import { Request, Response } from 'express';
import { prisma } from '../app';
import { sendEmail } from '../utils/email';
import crypto from 'crypto';
import logger from '../utils/logger';
import { createAuthToken } from '../utils/jwt';

// Store OTPs in memory (in production, use Redis or database)
const otpStore: Record<string, { otp: string; expiresAt: Date }> = {};

// Generate a 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        tenantId: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP (in production, store in database or Redis)
    otpStore[email] = { otp, expiresAt };

    // Send OTP via email
    await sendEmail({
      to: email,
      subject: 'Your OTP for Xeno Shopify Insights',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Your OTP for Login</h2>
          <p>Hello ${user.username || 'User'},</p>
          <p>Your One-Time Password (OTP) for login is:</p>
          <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes.</p>
          <p>If you didn't request this OTP, please ignore this email.</p>
          <p>Best regards,<br>The Xeno Team</p>
        </div>
      `,
    });

    logger.info(`OTP sent to ${email}`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    logger.error('Error sending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Get stored OTP
    const storedOtp = otpStore[email];

    // Check if OTP exists and is not expired
    if (!storedOtp || new Date() > storedOtp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Verify OTP
    if (storedOtp.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    // Clear the OTP after successful verification
    delete otpStore[email];

    // First, get the full user to update verification status
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update user verification status if not already verified
    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    // Get the user data to return (without sensitive fields)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      tenantId: user.tenantId,
      isVerified: true, // Always true at this point
      createdAt: user.createdAt,
    };

    // Generate JWT token
    const token = createAuthToken(userData);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        user: userData,
        token,
      },
    });
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
