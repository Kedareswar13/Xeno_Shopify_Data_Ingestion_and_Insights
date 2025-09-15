import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PrismaClient, Store } from '@prisma/client';
import { AppError, catchAsync } from '../middleware/error.middleware';
import logger from '../utils/logger';
import { ShopifyService, ShopifySyncService } from '../services/shopify.service';
import { AuthUser } from '../types/auth';

interface RequestWithUser extends Request {
  user?: AuthUser;
}

const prisma = new PrismaClient();

export class ShopifySyncController {
  private static async resolveStoreForRequest(storeId: string, req: RequestWithUser, next: NextFunction) {
    // Load store
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return next(new AppError('Store not found', StatusCodes.NOT_FOUND));
    }

    // Enforce tenant match (requires authenticated user)
    const tenantId = req.user?.tenantId as string | undefined;
    if (!tenantId) {
      return next(new AppError('Unauthorized', StatusCodes.UNAUTHORIZED));
    }
    if (store.tenantId !== tenantId) {
      return next(new AppError('Forbidden', StatusCodes.FORBIDDEN));
    }
    return store;
  }
  /**
   * Trigger a full data sync for a store
   */
  static syncStoreData = catchAsync(async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const { storeId } = req.params;
    const store = await ShopifySyncController.resolveStoreForRequest(storeId, req, next);
    if (!store) return; // next() has been called with error

    if (!store.accessToken) {
      return next(new AppError('Store is not connected to Shopify', StatusCodes.BAD_REQUEST));
    }

    // Start sync in background
    ShopifySyncController.startBackgroundSync(store);

    res.status(StatusCodes.ACCEPTED).json({
      status: 'success',
      message: 'Data sync started in the background',
      data: {
        storeId: store.id,
        domain: store.domain,
        lastSyncedAt: store.lastSyncedAt,
      },
    });
  });

  /**
   * Get sync status for a store
   */
  static getSyncStatus = catchAsync(async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const { storeId } = req.params;
    // Ensure access (dev-safe)
    const accessStore = await ShopifySyncController.resolveStoreForRequest(storeId, req, next);
    if (!accessStore) return;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        domain: true,
        lastSyncedAt: true,
        _count: { select: { products: true, customers: true, orders: true } },
      },
    });
    if (!store) {
      return next(new AppError('Store not found', StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        storeId: store.id,
        domain: store.domain,
        lastSyncedAt: store.lastSyncedAt,
        stats: {
          products: store._count.products,
          customers: store._count.customers,
          orders: store._count.orders,
        },
      },
    });
  });

  /**
   * Helper method to start sync in background
   */
  private static async startBackgroundSync(store: Store) {
    const syncService = new ShopifySyncService(store, prisma);
    
    try {
      logger.info(`Starting background sync for store: ${store.domain}`);
      
      // Update sync status
      await prisma.store.update({
        where: { id: store.id },
        data: { 
          lastSyncedAt: new Date()
        },
      });

      // Perform the sync operations
      await syncService.syncAllData();
      
      logger.info(`Completed background sync for store: ${store.domain}`);
      
      return true;
    } catch (error) {
      logger.error(`Background sync failed for store ${store.domain}:`, error);
      throw error; // Re-throw to be handled by the catchAsync wrapper
    }
  }

  /**
   * Sync products for a store
   */
  static syncProducts = catchAsync(async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const { storeId } = req.params;
    const store = await ShopifySyncController.resolveStoreForRequest(storeId, req, next);
    if (!store) return;

    if (!store.accessToken) {
      return next(new AppError('Store is not connected to Shopify', StatusCodes.BAD_REQUEST));
    }

    const syncService = new ShopifySyncService(store, prisma);
    await syncService.syncProducts();

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Products synced successfully',
    });
  });

  /**
   * Sync customers for a store
   */
  static syncCustomers = catchAsync(async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const { storeId } = req.params;
    const store = await ShopifySyncController.resolveStoreForRequest(storeId, req, next);
    if (!store) return;

    if (!store.accessToken) {
      return next(new AppError('Store is not connected to Shopify', StatusCodes.BAD_REQUEST));
    }

    const syncService = new ShopifySyncService(store, prisma);
    await syncService.syncCustomers();

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Customers synced successfully',
    });
  });

  /**
   * Sync orders for a store
   */
  static syncOrders = catchAsync(async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const { storeId } = req.params;
    const { startDate, endDate } = req.query;
    const store = await ShopifySyncController.resolveStoreForRequest(storeId, req, next);
    if (!store) return;

    if (!store.accessToken) {
      return next(new AppError('Store is not connected to Shopify', StatusCodes.BAD_REQUEST));
    }

    const syncService = new ShopifySyncService(store, prisma);
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date();
    start.setDate(start.getDate() - 30);

    await syncService.syncOrders({
      created_at_min: start.toISOString(),
      created_at_max: end.toISOString()
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Orders synced successfully',
      data: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    });
  });
}

export default ShopifySyncController;
