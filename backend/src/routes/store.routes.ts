import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as storeController from '../controllers/store.controller';
import { protect } from '../middleware/auth.middleware';
import { catchAsync } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// Routes
router
  .route('/')
  // In dev the GET above already exists; registering this again after protect keeps prod behavior
  .get(catchAsync(storeController.getStores))
  .post(
    [
      body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Store name must be between 2 and 100 characters'),
      body('domain')
        .trim()
        .notEmpty()
        .withMessage('Domain is required')
        .matches(/^[a-z0-9-]+\.myshopify\.com$/i)
        .withMessage('Domain must be a valid myshopify.com domain'),
      body('accessToken')
        .notEmpty()
        .withMessage('Access token is required')
        .isLength({ min: 10 })
        .withMessage('Access token must be at least 10 characters long'),
    ],
    catchAsync(storeController.connectStore)
  );

router
  .route('/:storeId')
  .get(
    [param('storeId').isUUID().withMessage('Invalid store ID')],
    catchAsync(storeController.getStore)
  )
  .patch(
    [
      param('storeId').isUUID().withMessage('Invalid store ID'),
      body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Store name must be between 2 and 100 characters'),
      body('shopifyShopId')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Shopify shop ID must be between 3 and 100 characters'),
      body('accessToken')
        .optional()
        .isLength({ min: 10 })
        .withMessage('Access token must be at least 10 characters long'),
    ],
    catchAsync(storeController.updateStore)
  )
  .delete(
    [param('storeId').isUUID().withMessage('Invalid store ID')],
    catchAsync(storeController.deleteStore)
  );

// Store statistics
router.get(
  '/:storeId/stats',
  [param('storeId').isUUID().withMessage('Invalid store ID')],
  catchAsync(storeController.getStoreStats)
);

// Shopify integration routes will be handled by shopify.routes.ts

export default router;
