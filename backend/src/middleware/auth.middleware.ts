import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';
import { AuthUser } from '../types/auth';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Get token from cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

    // Get user from the token
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        tenantId: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Add user to request with proper typing
    (req as any).user = user as AuthUser;
    next();
  } catch (error) {
    logger.error('Error in auth middleware:', error);
    return res.status(401).json({
      success: false,
      error: 'Not authorized',
    });
  }
};

// Ensures the authenticated user has access to the requested tenant
export const checkTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser | undefined;
    const { tenantId } = req.params as { tenantId?: string };

    if (!user || !user.tenantId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: 'Not authorized',
      });
    }

    if (tenantId && user.tenantId !== tenantId) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: 'You do not have access to this tenant',
      });
    }

    next();
  } catch (err) {
    logger.error('Error in checkTenantAccess:', err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Server error',
    });
  }
};
