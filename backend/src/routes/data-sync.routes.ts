import { Router } from 'express';
import { DataSyncController } from '../controllers/data-sync.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes with authentication
router.use(protect);

/**
 * @swagger
 * /api/sync/store/{storeId}:
 *   post:
 *     summary: Trigger a full data sync for a store
 *     tags: [Data Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The store ID
 *     responses:
 *       200:
 *         description: Sync started successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Store not found
 */
router.post('/store/:storeId', DataSyncController.syncStoreData);

/**
 * @swagger
 * /api/sync/store/{storeId}/status:
 *   get:
 *     summary: Get sync status for a store
 *     tags: [Data Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The store ID
 *     responses:
 *       200:
 *         description: Sync status retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Store not found
 */
router.get('/store/:storeId/status', DataSyncController.getSyncStatus);

/**
 * @swagger
 * /api/sync/store/{storeId}/{dataType}:
 *   post:
 *     summary: Sync specific data type for a store
 *     tags: [Data Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The store ID
 *       - in: path
 *         name: dataType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [products, customers, orders]
 *         description: The type of data to sync
 *     responses:
 *       200:
 *         description: Data sync completed successfully
 *       400:
 *         description: Invalid data type
 *       403:
 *         description: Access denied
 *       404:
 *         description: Store not found
 */
router.post('/store/:storeId/:dataType', DataSyncController.syncStoreDataType);

export default router;
