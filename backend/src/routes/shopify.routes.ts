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
  getSalesData,
  getCustomerSplit,
  getSalesByType,
  getTrafficHeatmap,
  getDiscountsSummary
} from '../controllers/dashboard.controller';
import { validateRequest } from '../middleware/validate-request.middleware';

const router = Router();

// Remove unauthenticated dev routes: all routes below are protected

// Apply protect middleware to all other (and production) routes
router.use(protect);

// Store endpoints
router.get(
  '/stores/:storeId',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.getSyncStatus)
);

// Sync endpoints
router.post(
  '/stores/:storeId/sync',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.syncStoreData)
);

router.get(
  '/stores/:storeId/sync/status',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.getSyncStatus)
);

router.post(
  '/stores/:storeId/sync/products',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.syncProducts)
);

router.post(
  '/stores/:storeId/sync/customers',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(ShopifySyncController.syncCustomers)
);

router.post(
  '/stores/:storeId/sync/orders',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
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
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getStoreAnalytics)
);

router.get(
  '/stores/:storeId/products/top',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getTopProducts)
);

router.get(
  '/stores/:storeId/orders/recent',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getRecentOrders)
);

router.get(
  '/stores/:storeId/customers/insights',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getCustomerInsights)
);

router.get(
  '/stores/:storeId/sales',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getSalesData)
);

// New analytics endpoints
router.get(
  '/stores/:storeId/customers/split',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getCustomerSplit)
);

router.get(
  '/stores/:storeId/sales/by-type',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getSalesByType)
);

router.get(
  '/stores/:storeId/traffic/heatmap',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getTrafficHeatmap)
);

router.get(
  '/stores/:storeId/discounts/summary',
  [
    param('storeId')
      .isString()
      .isLength({ min: 12 })
      .withMessage('Invalid store ID'),
    validateRequest,
  ],
  catchAsync(getDiscountsSummary)
);
