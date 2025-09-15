import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';
import { AuthUser } from '../types/auth';
import { storeService } from '../services/store.service';
import { prisma } from '../utils/prisma';

/**
 * Connect a new Shopify store to the tenant
 */
export const connectStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domain, accessToken, name } = req.body as {
      domain: string;
      accessToken: string;
      name: string;
    };
    
    const user = req.user as AuthUser;
    const tenantId = user.tenantId as string;

    if (!domain || !accessToken) {
      return next(
        new AppError('Domain and access token are required', StatusCodes.BAD_REQUEST)
      );
    }

    // Connect the store using the store service
    const store = await storeService.connectStore({
      tenantId,
      domain,
      accessToken,
      name: name || domain.replace(/\.myshopify\.com$/i, ''),
      // Extract scope from the token if available
      scope: [],
    });

    // Verify the store connection
    const isConnected = await storeService.verifyStoreConnection(store);
    
    if (!isConnected) {
      // If verification fails, mark as inactive
      await storeService.disconnectStore(store.id);
      return next(
        new AppError('Failed to verify store connection', StatusCodes.BAD_REQUEST)
      );
    }

    // Update last sync time
    await storeService.updateLastSync(store.id);

    // Remove sensitive data from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accessToken: _, ...storeWithoutToken } = store;

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: {
        store: storeWithoutToken,
      },
    });
  } catch (error) {
    logger.error('Error connecting store:', error);
    next(error);
  }
};

/**
 * Get all stores for the current tenant
 */
export const getStores = async (req: Request, res: Response, next: NextFunction) => {
  if (!prisma) {
    return next(new AppError('Database connection error', StatusCodes.INTERNAL_SERVER_ERROR));
  }
  try {
    const user = req.user as AuthUser;
    const { tenantId } = user || ({} as any);
    if (!tenantId || typeof tenantId !== 'string') {
      return next(new AppError('Unauthorized', StatusCodes.UNAUTHORIZED));
    }
    const { page = 1, limit = 10, search } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    // Build where clause
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { domain: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        select: {
          id: true,
          name: true,
          domain: true,
          shopifyId: true,
          isActive: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.store.count({ where }),
    ]);

    // No auto-provisioning; tenant must connect a store explicitly

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        stores,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting stores:', error);
    next(error);
  }
};

/**
 * Get a single store by ID with detailed information
 */
export const getStore = async (req: Request, res: Response, next: NextFunction) => {
  if (!prisma) {
    return next(new AppError('Database connection error', StatusCodes.INTERNAL_SERVER_ERROR));
  }
  try {
    const { id } = req.params;
    const user = req.user as AuthUser;
    const { tenantId } = user;

    // Get store with counts and basic info
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            customers: true,
            orders: true,
            events: true,
          },
        },
      },
    });

    if (!store) {
      return next(new AppError('Store not found', StatusCodes.NOT_FOUND));
    }

    // Ensure the store belongs to the user's tenant
    if (store.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to access this store', StatusCodes.FORBIDDEN)
      );
    }

    // Get recent orders with customer info
    const recentOrders = await prisma.order.findMany({
      where: { storeId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        totalPrice: true,
        financialStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Get store statistics
    const stats = await prisma.$transaction([
      prisma.order.aggregate({
        where: { storeId: id },
        _sum: { 
          totalPrice: true,
          subtotalPrice: true,
          totalTax: true,
          totalDiscounts: true,
          totalLineItemsPrice: true 
        },
      }),
    ]);

    // Remove sensitive data
    const { accessToken, ...storeWithoutSensitiveData } = store;

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        store: {
          ...storeWithoutSensitiveData,
          stats: stats[0] || {},
          recentOrders,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting store:', error);
    next(error);
  }
};

/**
 * Update store information
 */
export const updateStore = async (req: Request, res: Response, next: NextFunction) => {
  if (!prisma) {
    return next(new AppError('Database connection error', StatusCodes.INTERNAL_SERVER_ERROR));
  }
  try {
    const { id } = req.params;
    const { name, isActive, accessToken } = req.body;
    const user = req.user as AuthUser;
    const { tenantId } = user;

    // Check if store exists and belongs to the user's tenant
    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return next(new AppError('Store not found', StatusCodes.NOT_FOUND));
    }

    if (store.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to update this store', StatusCodes.FORBIDDEN)
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Only update access token if provided and different
    if (accessToken && accessToken !== store.accessToken) {
      updateData.accessToken = accessToken;
      
      // Verify the new token if provided
      const isConnected = await storeService.verifyStoreConnection({
        ...store,
        accessToken,
      });
      
      if (!isConnected) {
        return next(
          new AppError('Failed to verify store connection with the provided token', 
          StatusCodes.BAD_REQUEST)
        );
      }
    }

    // Update the store
    const updatedStore = await prisma.store.update({
      where: { id },
      data: updateData,
    });

    // Remove sensitive data from the response
    const { accessToken: _, ...storeWithoutSensitiveData } = updatedStore;

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        store: storeWithoutSensitiveData,
      },
    });
  } catch (error) {
    logger.error('Error updating store:', error);
    next(error);
  }
};

/**
 * Delete a store
 */
export const deleteStore = async (req: Request, res: Response, next: NextFunction) => {
  if (!prisma) {
    return next(new AppError('Database connection error', StatusCodes.INTERNAL_SERVER_ERROR));
  }
  try {
    const { id } = req.params;
    const user = req.user as AuthUser;
    const { tenantId } = user;

    // Check if store exists and belongs to the user's tenant
    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return next(new AppError('Store not found', StatusCodes.NOT_FOUND));
    }

    if (store.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to delete this store', StatusCodes.FORBIDDEN)
      );
    }

    // Use a transaction to ensure data consistency
    await prisma.$transaction([
      // Delete all related data
      prisma.product.deleteMany({
        where: { storeId: id },
      }),
      prisma.customer.deleteMany({
        where: { storeId: id },
      }),
      prisma.order.deleteMany({
        where: { storeId: id },
      }),
      prisma.event.deleteMany({
        where: { storeId: id },
      }),
      // Finally, delete the store
      prisma.store.delete({
        where: { id },
      }),
    ]);

    res.status(StatusCodes.NO_CONTENT).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    logger.error('Error deleting store:', error);
    next(error);
  }
};

/**
 * Get store statistics
 */
export const getStoreStats = async (req: Request, res: Response, next: NextFunction) => {
  if (!prisma) {
    return next(new AppError('Database connection error', StatusCodes.INTERNAL_SERVER_ERROR));
  }
  try {
    const { id } = req.params;
    const user = req.user as AuthUser;
    const { tenantId } = user;

    // Check if store exists and belongs to the user's tenant
    const store = await prisma.store.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });

    if (!store) {
      return next(new AppError('Store not found', StatusCodes.NOT_FOUND));
    }

    if (store.tenantId !== tenantId) {
      return next(
        new AppError('You do not have permission to view this store', StatusCodes.FORBIDDEN)
      );
    }

    // Get counts for different metrics
    const [productsCount, customersCount, ordersCount, revenueData, recentOrders, topCustomers] =
      await Promise.all([
        prisma.product.count({ where: { storeId: store.id } }),
        prisma.customer.count({ where: { storeId: store.id } }),
        prisma.order.count({ where: { storeId: store.id } }),
        prisma.order.aggregate({
          where: { storeId: store.id },
          _sum: { 
            totalPrice: true,
            subtotalPrice: true,
            totalTax: true,
            totalDiscounts: true,
            totalLineItemsPrice: true 
          },
        }),
        prisma.order.findMany({
          where: { storeId: store.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            orderNumber: true,
            totalPrice: true,
            financialStatus: true,
            fulfillmentStatus: true,
            createdAt: true,
          },
        }),
        prisma.customer.findMany({
          where: { storeId: store.id },
          orderBy: { totalSpend: 'desc' },
          take: 5,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            totalSpend: true,
            _count: {
              select: { orders: true },
            },
          },
        }),
      ]);

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        stats: {
          productsCount,
          customersCount,
          ordersCount,
          totalAmount: revenueData._sum.totalPrice || 0,
        },
        recentOrders,
        topCustomers,
      },
    });
  } catch (error) {
    logger.error('Error getting store stats:', error);
    next(error);
  }
};
