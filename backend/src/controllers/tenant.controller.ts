import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../utils/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import logger from '../utils/logger';
import { AuthUser } from '../types/auth';

// Type guard to check if user is authenticated with tenant
const hasTenant = (user: any): user is AuthUser & { tenantId: string } => {
  return user && user.id && user.tenantId;
};

export const createTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !hasTenant(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    const { name } = req.body;
    const userId = req.user.id;

    // Create tenant and assign the current user as the owner
    const tenant = await prisma.tenant.create({
      data: {
        name,
        users: {
          connect: { id: userId },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: {
        tenant,
      },
    });
  } catch (error) {
    logger.error('Error creating tenant:', error);
    next(error);
  }
};

export const getTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !hasTenant(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        stores: {
          select: {
            id: true,
            name: true,
            shopifyId: true,
            domain: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          },
        },
      },
    });

    if (!tenant) {
      return next(new AppError('Tenant not found', StatusCodes.NOT_FOUND));
    }

    // Check if the requesting user has access to this tenant
    if (req.user.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to access this tenant', StatusCodes.FORBIDDEN)
      );
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        tenant,
      },
    });
  } catch (error) {
    logger.error('Error getting tenant:', error);
    next(error);
  }
};

export const updateTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !hasTenant(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    const { tenantId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return next(new AppError('Name is required', StatusCodes.BAD_REQUEST));
    }

    // Update tenant name using direct assignment
    const updateData: { name: string } = { name };

    if (Object.keys(updateData).length === 0) {
      return next(new AppError('No valid fields to update', StatusCodes.BAD_REQUEST));
    }

    // Check if the user has access to this tenant
    if (req.user.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to update this tenant', StatusCodes.FORBIDDEN)
      );
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        tenant: updatedTenant,
      },
    });
  } catch (error) {
    logger.error('Error updating tenant:', error);
    next(error);
  }
};

export const deleteTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !hasTenant(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    const { tenantId } = req.params;
    
    // Check if the user has access to this tenant
    if (req.user.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to delete this tenant', StatusCodes.FORBIDDEN)
      );
    }

    // Use a transaction to ensure data consistency
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete all related data
      await tx.store.deleteMany({
        where: { tenantId },
      });

      // Update all users to remove them from the tenant using raw SQL
      await tx.$executeRaw`
        UPDATE "User"
        SET "tenantId" = NULL
        WHERE "tenantId" = ${tenantId}
      `;

      // Finally, delete the tenant
      await tx.tenant.delete({
        where: { id: tenantId },
      });
    });

    res.status(StatusCodes.NO_CONTENT).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    logger.error('Error deleting tenant:', error);
    next(error);
  }
};

export const getTenantUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !hasTenant(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    const { tenantId } = req.params;
    
    // Check if the user has access to this tenant
    if (req.user.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to view users in this tenant', StatusCodes.FORBIDDEN)
      );
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        username: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      results: users.length,
      data: {
        users,
      },
    });
  } catch (error) {
    logger.error('Error getting tenant users:', error);
    next(error);
  }
};

export const addUserToTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !hasTenant(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    const { tenantId } = req.params;
    const { email, role = 'MEMBER' } = req.body;

    // Check if the user has permission to add users to this tenant
    if (req.user.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to add users to this tenant', StatusCodes.FORBIDDEN)
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return next(new AppError('No user found with that email', StatusCodes.NOT_FOUND));
    }

    // Check if user already belongs to a tenant
    if (user.tenantId) {
      return next(
        new AppError('User already belongs to a tenant', StatusCodes.BAD_REQUEST)
      );
    }

    // Add user to tenant
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tenant: {
          connect: { id: tenantId },
        },
      },
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'User added to tenant successfully',
    });
  } catch (error) {
    logger.error('Error adding user to tenant:', error);
    next(error);
  }
};

export const removeUserFromTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !hasTenant(req.user)) {
      return next(new AppError('You are not logged in', StatusCodes.UNAUTHORIZED));
    }

    const { tenantId, userId } = req.params;

    // Check if the user has permission to remove users from this tenant
    if (req.user.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to remove users from this tenant', StatusCodes.FORBIDDEN)
      );
    }

    // Prevent removing yourself from the tenant
    if (req.user.id === userId) {
      return next(
        new AppError('You cannot remove yourself from the tenant', StatusCodes.BAD_REQUEST)
      );
    }

    // Remove user from tenant by directly updating the tenantId to null
    await prisma.$executeRaw`
      UPDATE "User"
      SET "tenantId" = NULL
      WHERE id = ${userId} AND "tenantId" = ${tenantId}
    `;

    res.status(StatusCodes.NO_CONTENT).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    logger.error('Error removing user from tenant:', error);
    next(error);
  }
};
