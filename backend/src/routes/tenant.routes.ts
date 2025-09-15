import { Router } from 'express';
import { body, param } from 'express-validator';
import * as tenantController from '../controllers/tenant.controller';
import { protect, checkTenantAccess } from '../middleware/auth.middleware';
import { catchAsync } from '../middleware/error.middleware';

const router = Router();

// Apply protect middleware to all routes
router.use(protect);

// Apply tenant access check to all routes with :tenantId
router.param('tenantId', (req, res, next, tenantId) => {
  req.params.tenantId = tenantId;
  next();
});

// Apply tenant access middleware to all routes with :tenantId parameter
router.use('/:tenantId', checkTenantAccess);

// Routes
router
  .route('/')
  .post(
    [
      body('name')
        .trim()
        .notEmpty()
        .withMessage('Tenant name is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('Tenant name must be between 3 and 50 characters'),
    ],
    catchAsync(tenantController.createTenant)
  );

router
  .route('/:tenantId')
  .get(catchAsync(tenantController.getTenant))
  .patch(
    [
      body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Tenant name cannot be empty')
        .isLength({ min: 3, max: 50 })
        .withMessage('Tenant name must be between 3 and 50 characters'),
    ],
    catchAsync(tenantController.updateTenant)
  )
  .delete(catchAsync(tenantController.deleteTenant));

// User management routes
router
  .route('/:tenantId/users')
  .get(catchAsync(tenantController.getTenantUsers))
  .post(
    [
      body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    ],
    catchAsync(tenantController.addUserToTenant)
  );

router
  .route('/:tenantId/users/:userId')
  .delete(catchAsync(tenantController.removeUserFromTenant));

export default router;
