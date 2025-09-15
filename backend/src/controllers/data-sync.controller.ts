import { Request, Response } from 'express';
import { prisma } from '../app';
import { DataSyncService } from '../services/data-sync.service';
import { ShopifyService } from '../services/shopify.service';
import logger from '../utils/logger';
import { AuthUser } from '../types/auth';

// Extend the Express Request type to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Type for authenticated requests
type AuthRequest = Request;

export class DataSyncController {
  // Sync all data for a store
  static async syncStoreData(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Find the store
      const store = await prisma.store.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Check if user has access to this store
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: true },
      });

      if (!user || user.tenantId !== store.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!store.accessToken) {
        return res.status(400).json({ error: 'Store is not configured with an access token.' });
      }

      // Initialize services
      const shopifyService = new ShopifyService(store);
      const syncService = new DataSyncService(shopifyService, store);

      // Start sync in background
      syncService.syncAllData().catch((error: Error) => {
        logger.error(`Background sync failed for store ${store.id}:`, error);
      });

      return res.json({ 
        success: true, 
        message: 'Sync started in background',
        storeId: store.id,
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in syncStoreData:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ 
        error: 'Failed to start data sync',
        details: errorMessage,
      });
    }
  }

  // Get sync status for a store
  static async getSyncStatus(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Find the store
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          domain: true,
          lastSyncedAt: true,
          tenantId: true,
          _count: {
            select: {
              products: true,
              customers: true,
              orders: true,
            },
          },
        },
      });

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Check if user has access to this store
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true },
      });

      if (!user || user.tenantId !== store.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({
        storeId: store.id,
        storeName: store.name,
        domain: store.domain,
        lastSyncedAt: store.lastSyncedAt,
        stats: {
          products: store._count.products,
          customers: store._count.customers,
          orders: store._count.orders,
        },
      });
    } catch (error) {
      logger.error('Error in getSyncStatus:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ 
        error: 'Failed to get sync status',
        details: errorMessage,
      });
    }
  }

  // Sync specific data type for a store
  static async syncStoreDataType(req: AuthRequest, res: Response) {
    try {
      const { storeId, dataType } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate data type
      const validDataTypes = ['products', 'customers', 'orders'];
      if (!validDataTypes.includes(dataType)) {
        return res.status(400).json({ 
          error: 'Invalid data type',
          validDataTypes,
        });
      }

      // Find the store
      const store = await prisma.store.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Check if user has access to this store
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: true },
      });

      if (!user || user.tenantId !== store.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!store.accessToken) {
        return res.status(400).json({ error: 'Store is not configured with an access token.' });
      }

      const shopifyService = new ShopifyService(store);
      const syncService = new DataSyncService(shopifyService, store);
      let result;

      // Call the appropriate sync method based on dataType
      switch (dataType) {
        case 'products':
          result = await syncService.syncProducts();
          break;
        case 'customers':
          result = await syncService.syncCustomers();
          break;
        case 'orders':
          result = await syncService.syncOrders();
          break;
        default:
          return res.status(400).json({ error: 'Invalid data type' });
      }

      // Update last synced time for the store
      await prisma.store.update({
        where: { id: store.id },
        data: { lastSyncedAt: new Date() },
      });

      return res.json({
        success: true,
        message: `${dataType} sync completed`,
        storeId: store.id,
        dataType,
        result,
        syncedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error in syncStoreDataType (${req.params.dataType}):`, error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ 
        error: `Failed to sync ${req.params.dataType}`,
        details: errorMessage,
      });
    }
  }
}

export default DataSyncController;
