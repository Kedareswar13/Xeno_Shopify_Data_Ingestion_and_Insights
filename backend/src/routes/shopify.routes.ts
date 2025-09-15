import { Router } from 'express';
import { param, query } from 'express-validator';
import { protect } from '../middleware/auth.middleware';
import { catchAsync } from '../middleware/error.middleware';
import { ShopifySyncController } from '../controllers/shopify-sync.controller';
import { 
  getStoreAnalytics,
  getTopProducts,
  getRecentOrders,
  getCustomerInsights,
  getSalesData
} from '../controllers/dashboard.controller';
import { validateRequest } from '../middleware/validate-request.middleware';

const router = Router();

// In development, expose dev-friendly routes without auth and with relaxed validators
if (process.env.NODE_ENV === 'development') {
  // Sync endpoints (dev)
  router.post(
    '/stores/:storeId/sync',
    [param('storeId').isString().withMessage('Invalid store ID')],
    catchAsync(ShopifySyncController.syncStoreData)
  );

  router.get(
    '/stores/:storeId/sync-status',
    [param('storeId').isString().withMessage('Invalid store ID')],
    catchAsync(ShopifySyncController.getSyncStatus)
  );

  // Analytics (dev)
  router.get(
    '/stores/:storeId/analytics',
    [param('storeId').isString().withMessage('Invalid store ID')],
    catchAsync(getStoreAnalytics)
  );
  router.get(
    '/stores/:storeId/products/top',
    [param('storeId').isString().withMessage('Invalid store ID')],
    catchAsync(getTopProducts)
  );
  router.get(
    '/stores/:storeId/orders/recent',
    [param('storeId').isString().withMessage('Invalid store ID')],
    catchAsync(getRecentOrders)
  );
  router.get(
    '/stores/:storeId/customers/insights',
    [param('storeId').isString().withMessage('Invalid store ID')],
    catchAsync(getCustomerInsights)
  );
  router.get(
    '/stores/:storeId/sales',
    [param('storeId').isString().withMessage('Invalid store ID')],
    catchAsync(getSalesData)
  );
}

// Apply protect middleware to all other (and production) routes
router.use(protect);

// Store endpoints
router.get(
  '/stores/:storeId',
  [
    param('storeId').isUUID().withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.getSyncStatus)
);

// Sync endpoints
router.post(
  '/stores/:storeId/sync',
  [
    param('storeId').isUUID().withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.syncStoreData)
);

router.get(
  '/stores/:storeId/sync/status',
  [
    param('storeId').isUUID().withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.getSyncStatus)
);

router.post(
  '/stores/:storeId/sync/products',
  [
    param('storeId').isUUID().withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.syncProducts)
);

router.post(
  '/stores/:storeId/sync/customers',
  [
    param('storeId').isUUID().withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.syncCustomers)
);

router.post(
  '/stores/:storeId/sync/orders',
  [
    param('storeId').isUUID().withMessage('Invalid store ID'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.syncOrders)
);

export default router;

// Analytics routes for dashboard
router.get(
  '/stores/:storeId/analytics',
  [param('storeId').isUUID().withMessage('Invalid store ID'), validateRequest],
  catchAsync(getStoreAnalytics)
);

router.get(
  '/stores/:storeId/products/top',
  [param('storeId').isUUID().withMessage('Invalid store ID'), validateRequest],
  catchAsync(getTopProducts)
);

router.get(
  '/stores/:storeId/orders/recent',
  [param('storeId').isUUID().withMessage('Invalid store ID'), validateRequest],
  catchAsync(getRecentOrders)
);

router.get(
  '/stores/:storeId/customers/insights',
  [param('storeId').isUUID().withMessage('Invalid store ID'), validateRequest],
  catchAsync(getCustomerInsights)
);

router.get(
  '/stores/:storeId/sales',
  [param('storeId').isUUID().withMessage('Invalid store ID'), validateRequest],
  catchAsync(getSalesData)
);
